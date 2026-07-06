'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Message } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Copy, Check, PenLine, Trash2, RotateCcw, Bot, User, ChevronRight, Brain } from 'lucide-react'

interface MarkdownMessageProps {
  message: Message
  onDelete: (id: string) => void
  onEdit: (id: string, content: string) => void
  onResend: (id: string) => void
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative my-2 rounded-md overflow-hidden">
      <div className="flex items-center justify-between bg-[#1e1e1e] px-4 py-1.5 text-xs text-gray-400">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-gray-200 transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.875rem',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

export function MarkdownMessage({ message, onDelete, onEdit, onResend }: MarkdownMessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [isThinkingOpen, setIsThinkingOpen] = useState(false)
  const isUser = message.role === 'user'
  const isStreaming = message.content === '' && message.role === 'assistant'
  const hasReasoning = !!message.reasoningContent

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(message.content)
    setIsEditing(false)
  }

  return (
    <div className={`group flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground'
      }`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={`flex flex-col gap-1 min-w-0 max-w-[85%] ${isUser ? 'items-end' : ''}`}>
        <div className={`rounded-xl px-4 py-2.5 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}>
          {hasReasoning && !isUser && (
            <div className="mb-2 rounded-lg border border-border/50 bg-background/50 overflow-hidden">
              <button
                onClick={() => setIsThinkingOpen(!isThinkingOpen)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
              >
                <Brain className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">Думает...</span>
                <ChevronRight className={`h-3 w-3 ml-auto shrink-0 transition-transform duration-200 ${isThinkingOpen ? 'rotate-90' : ''}`} />
              </button>
              <div
                className="grid transition-all duration-200 ease-in-out"
                style={{
                  gridTemplateRows: isThinkingOpen ? '1fr' : '0fr',
                }}
              >
                <div className="overflow-hidden">
                  <div className="px-3 pb-3 text-xs text-muted-foreground/80 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {message.reasoningContent}
                  </div>
                </div>
              </div>
            </div>
          )}
          {isStreaming ? (
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
              <span className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
              <span className="h-2 w-2 rounded-full bg-current animate-bounce" />
            </div>
          ) : isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[100px] rounded-md border bg-background text-foreground p-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>Сохранить</Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Отмена</Button>
              </div>
            </div>
          ) : (
            <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''} [&_pre]:bg-transparent [&_pre]:p-0 [&_p]:mb-2 [&_p:last-child]:mb-0`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props) {
                    const { children, className, ...rest } = props
                    const match = /language-(\w+)/.exec(className || '')
                    const codeString = String(children).replace(/\n$/, '')
                    if (match) {
                      return <CodeBlock language={match[1]}>{codeString}</CodeBlock>
                    }
                    if (codeString.includes('\n')) {
                      return <CodeBlock language="">{codeString}</CodeBlock>
                    }
                    return (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...rest}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isStreaming && !isEditing && (
          <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
            isUser ? 'flex-row-reverse' : ''
          }`}>
            {isUser && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onResend(message.id)}
                title="Отправить заново"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
            {isUser && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setEditContent(message.content)
                  setIsEditing(true)
                }}
                title="Редактировать"
              >
                <PenLine className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(message.id)}
              title="Удалить"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
