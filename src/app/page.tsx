'use client'

import dynamic from 'next/dynamic'

const ChatPage = dynamic(() => import('./chat').then((mod) => mod.ChatPage), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    </div>
  ),
})

export default function Page() {
  return <ChatPage />
}
