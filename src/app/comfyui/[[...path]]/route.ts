import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3002'

const agentPortCache = new Map<string, { port: number; expires: number }>()
const PORT_CACHE_TTL = 60_000

async function getAgentHttpPort(token: string): Promise<number | null> {
  const cached = agentPortCache.get(token)
  if (cached && cached.expires > Date.now()) {
    return cached.port
  }
  try {
    const res = await fetch(`${WS_SERVER_URL}/api/agent/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(3000),
    })
    const data = await res.json()
    if (data.online && data.httpPort) {
      agentPortCache.set(token, { port: data.httpPort, expires: Date.now() + PORT_CACHE_TTL })
      return data.httpPort
    }
  } catch {}
  agentPortCache.set(token, { port: 0, expires: Date.now() + 5000 })
  return null
}

function buildResponse(body: Buffer, contentType: string, statusCode: number, isHtmlPage: boolean, hasTokenInQuery: boolean, agentToken: string): NextResponse {
  let finalBody = body
  if (contentType.includes('text/html')) {
    finalBody = rewriteHtml(body, agentToken)
  }

  const respHeaders: Record<string, string> = {
    'Content-Type': contentType,
  }
  if (contentType.includes('text/html')) {
    respHeaders['Cache-Control'] = 'no-cache'
  }

  if (isHtmlPage && hasTokenInQuery) {
    respHeaders['Set-Cookie'] = `agent-token=${agentToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  }

  return new NextResponse(finalBody, {
    status: statusCode,
    headers: respHeaders,
  })
}

async function handleTunnel(req: NextRequest) {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/comfyui/, '') || '/'

  let agentToken = url.searchParams.get('token')
  if (!agentToken) {
    agentToken = req.cookies.get('agent-token')?.value || null
  }
  if (!agentToken) {
    agentToken = req.headers.get('x-agent-token') || null
  }
  if (!agentToken) {
    return NextResponse.json({ error: 'Токен не указан' }, { status: 401 })
  }

  const isHtmlPage = path === '/' || path === '/index.html'
  const hasTokenInQuery = !!url.searchParams.get('token')

  if (hasTokenInQuery) {
    url.searchParams.delete('token')
  }
  const cleanSearch = url.searchParams.toString()
  const cleanSearchFull = cleanSearch ? '?' + cleanSearch : ''

  let bodyBase64: string | null = null
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    try {
      const raw = await req.arrayBuffer()
      if (raw.byteLength > 0) {
        bodyBase64 = Buffer.from(raw).toString('base64')
      }
    } catch { }
  }

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    if (!['host', 'x-agent-token', 'content-length', 'origin', 'referer'].includes(k) && !k.startsWith('sec-')) {
      headers[k] = v
    }
  })

  // Try direct HTTP to Agent's proxy (faster, no Socket.IO overhead)
  const httpPort = await getAgentHttpPort(agentToken)
  if (httpPort) {
    try {
      const agentHeaders: Record<string, string> = { ...headers, 'x-agent-token': agentToken }
      let agentBody: BodyInit | undefined
      if (bodyBase64) {
        agentBody = Buffer.from(bodyBase64, 'base64')
      }

      const agentRes = await fetch(`http://127.0.0.1:${httpPort}${path}${cleanSearchFull}`, {
        method: req.method,
        headers: agentHeaders,
        body: agentBody,
        signal: AbortSignal.timeout(120_000),
      })

      const resBody = Buffer.from(await agentRes.arrayBuffer())
      const contentType = agentRes.headers.get('content-type') || 'application/octet-stream'

      return buildResponse(resBody, contentType, agentRes.status, isHtmlPage, hasTokenInQuery, agentToken)
    } catch (e) {
      // Fall through to Socket.IO tunnel
    }
  }

  // Fall back to Socket.IO tunnel
  let tunnelRes
  try {
    tunnelRes = await fetch(`${WS_SERVER_URL}/api/agent/tunnel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: agentToken,
        method: req.method,
        path: path + cleanSearchFull,
        headers,
        body: bodyBase64,
      }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (e) {
    return NextResponse.json({ error: 'WS Server недоступен: ' + (e instanceof Error ? e.message : '') }, { status: 502 })
  }

  if (!tunnelRes.ok) {
    const text = await tunnelRes.text(); let err; try { err = JSON.parse(text); } catch (e) { err = { error: 'WS error: ' + text.slice(0, 200) }; }
    return NextResponse.json(err, { status: 502 })
  }

  const data = await tunnelRes.json()

  if (data.error) {
    return NextResponse.json({ error: data.error }, { status: 502 })
  }

  const decodedBody = Buffer.from(data.body || '', 'base64')
  const contentType = (Array.isArray(data.headers?.['content-type'])
    ? data.headers['content-type'][0]
    : data.headers?.['content-type']) || 'application/octet-stream'

  return buildResponse(decodedBody, contentType, data.statusCode || 200, isHtmlPage, hasTokenInQuery, agentToken)
}

function rewriteHtml(buf: Buffer, token: string): Buffer {
  let html = buf.toString('utf-8')
  const q = JSON.stringify(token)
  const t = encodeURIComponent(token)

  html = html.replace('<head>', '<head><base href="/comfyui/">')

  html = html.replace(/(src|href|action)="([^"]+)"/g, (m, a, u) => {
    if (u.startsWith('http') || u.startsWith('data:') || u.startsWith('#') || u.includes('token=')) return m
    const hi = u.indexOf('#')
    const qi = u.indexOf('?')
    const f = hi >= 0 ? u.slice(hi) : ''
    const b = hi >= 0 ? u.slice(0, hi) : u
    const s = qi >= 0 ? '&' : '?'
    if (u.startsWith('/') && !u.startsWith('//')) {
      if (u.startsWith('/comfyui')) return m
      return `${a}="/comfyui${b}${s}token=${t}${f}"`
    }
    if (!u.startsWith('//')) {
      return `${a}="${b}${s}token=${t}${f}"`
    }
    return m
  })

  html = html.replace(/@import\s+url\("([^"]+)"/g, (m, u) => {
    if (u.startsWith('http') || u.includes('token=')) return m
    const s = u.indexOf('?') >= 0 ? '&' : '?'
    if (u.startsWith('/') && !u.startsWith('/comfyui')) {
      return `@import url("/comfyui${u}${s}token=${t}"`
    }
    return `@import url("${u}${s}token=${t}"`
  })

  html = html.replace(/url\("([^"]+)"/g, (m, u) => {
    if (u.startsWith('http') || u.startsWith('data:') || u.startsWith('#') || u.includes('token=')) return m
    const s = u.indexOf('?') >= 0 ? '&' : '?'
    if (u.startsWith('/') && !u.startsWith('//') && !u.startsWith('/comfyui')) {
      return `url("/comfyui${u}${s}token=${t}"`
    }
    if (!u.startsWith('//')) {
      return `url("${u}${s}token=${t}"`
    }
    return m
  })

  const patchScript = `<script>
(function(){
  var T=${q};
  document.cookie="agent-token="+encodeURIComponent(T)+";path=/;max-age=86400;samesite=lax";
  var f=window.fetch;
  window.fetch=function(u,o){
    var s=typeof u==="string"?u:u&&u.href?u.href:u&&u.url?u.url:null;
    if(s&&typeof s==="string"){
      if(s.indexOf("://")>=0){
        try{var p=new URL(s);if(p.origin===location.origin&&p.pathname[0]==="/"&&!p.pathname.startsWith("/comfyui"))u="/comfyui"+p.pathname+p.search}catch(e){}
      }else if(s[0]==="/"&&!s.startsWith("/comfyui")&&!s.startsWith("//")){u="/comfyui"+s}
    }
    return f.call(this,u,o)
  };
  var ox=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u,a,us,p){
    if(typeof u==="string"&&u[0]==="/"&&!u.startsWith("/comfyui")&&!u.startsWith("//"))u="/comfyui"+u;
    return ox.call(this,m,u,a,us,p)
  };
  var _sd=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src");
  if(_sd&&_sd.set){
    Object.defineProperty(HTMLImageElement.prototype,"src",{
      set:function(v){
        if(typeof v==="string"){
          if(v[0]==="/"&&v[1]!=="/"&&v.indexOf("/comfyui")!==0){
            v="/comfyui"+v
          }else if(v.indexOf("://")>0){
            try{var p=new URL(v);if(p.origin===location.origin&&p.pathname[0]==="/"&&p.pathname.indexOf("/comfyui")!==0)v="/comfyui"+p.pathname+p.search}catch(e){}
          }
        }
        _sd.set.call(this,v)
      },
      get:_sd.get
    });
  }
  var _sa=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(n,v){
    if(typeof v==="string"&&(n==="src"||n==="href"||n==="action")){
      if(v[0]==="/"&&v[1]!=="/"&&v.indexOf("/comfyui")!==0){
        v="/comfyui"+v
      }else if(v.indexOf("://")>0){
        try{var p=new URL(v);if(p.origin===location.origin&&p.pathname[0]==="/"&&p.pathname.indexOf("/comfyui")!==0)v="/comfyui"+p.pathname+p.search}catch(e){}
      }
    }
    return _sa.call(this,n,v)
  };
  var _ow=window.open;
  window.open=function(u,t,f){
    if(typeof u==="string"&&u[0]==="/"&&u[1]!=="/"&&u.indexOf("/comfyui")!==0)u="/comfyui"+u;
    return _ow.call(this,u,t,f)
  };
  var ow=window.WebSocket;
  window.WebSocket=function(u,pr){
    if(typeof u==="string"&&u.indexOf("/ws?")!==-1){
      var c=(u.match(/clientId=([^&]+)/)||[])[1]||"";
      u=(location.protocol==="https:"?"wss:":"ws:")+"//"+location.hostname+":3002/comfyui/ws?clientId="+encodeURIComponent(c)+"&token="+encodeURIComponent(T)
    }
    return new ow(u,pr)
  };
  window.WebSocket.prototype=ow.prototype;
  for(var k in ow)window.WebSocket[k]=ow[k]
})();
<\/script><\/head>`

  html = html.replace('<\/head>', patchScript)
  return Buffer.from(html, 'utf-8')
}

export const GET = handleTunnel
export const POST = handleTunnel
export const PUT = handleTunnel
export const DELETE = handleTunnel
export const PATCH = handleTunnel
export const HEAD = handleTunnel
export const OPTIONS = handleTunnel
