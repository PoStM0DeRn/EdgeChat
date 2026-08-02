'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, ChevronLeft, ChevronRight, Download, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/lib/store'

const AGENT_DOWNLOAD_URL =
  'https://github.com/PoStM0DeRn/EdgeChat/releases/download/v1.0.0/EdgeChat.Agent.1.0.0.exe'

interface StepData {
  target?: string
  title: string
  description: string
  position?: 'bottom' | 'top' | 'left' | 'right'
  action?: () => void
}

const STEPS: StepData[] = [
  {
    title: 'Добро пожаловать в EdgeChat!',
    description:
      'Ваш персональный ИИ теперь доступен с любого устройства. Подключите Desktop-Агент в три шага, затем этот тур покажет остальные возможности.',
  },
  {
    target: '[data-tour="sidebar-toggle"]',
    title: 'Боковое меню',
    description: 'Нажмите сюда, чтобы открыть панель с настройками, историей чатов, документами и промптами.',
    position: 'right',
  },
  {
    target: '[data-tour="tab-settings"]',
    title: 'Настройки',
    description: 'Здесь вы подключите Desktop-Агент: создайте токен и укажите его в Агенте для подключения.',
    position: 'bottom',
  },
  {
    target: '[data-tour="agent-token"]',
    title: 'Токен Агента',
    description: 'Создайте новый токен или вставьте существующий. Скопируйте его в Desktop-Агент.',
    position: 'left',
  },
  {
    target: '[data-tour="tab-documents"]',
    title: 'Документы',
    description: 'Загружайте PDF, TXT или MD файлы для RAG-поиска. Чат будет отвечать на основе ваших документов.',
    position: 'bottom',
  },
  {
    target: '[data-tour="chat-input"]',
    title: 'Начните общение',
    description: 'Готово! Теперь, когда Агент подключён, можно отправлять сообщения и пользоваться всеми возможностями.',
    position: 'top',
  },
]

const CARD_WIDTH = 320
const CARD_HEIGHT_ESTIMATE = 300

function getCardPosition(
  step: StepData,
  rect: DOMRect | null
): { top: number | string; left: number | string; transform?: string } {
  if (!step.target || !rect) {
    return { top: '10%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const gap = 16
  const vw = window.innerWidth
  const vh = window.innerHeight
  let top = 0
  let left = 0

  switch (step.position) {
    case 'right':
      top = rect.top + rect.height / 2 - CARD_HEIGHT_ESTIMATE / 2
      left = rect.right + gap
      if (left + CARD_WIDTH > vw - 16) left = rect.left - CARD_WIDTH - gap
      if (top < 16) top = 16
      if (top + CARD_HEIGHT_ESTIMATE > vh - 16) top = vh - CARD_HEIGHT_ESTIMATE - 16
      break
    case 'bottom':
      top = rect.bottom + gap
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2
      if (left < 16) left = 16
      if (left + CARD_WIDTH > vw - 16) left = vw - CARD_WIDTH - 16
      if (top + CARD_HEIGHT_ESTIMATE > vh - 16) top = rect.top - CARD_HEIGHT_ESTIMATE - gap
      break
    case 'left':
      top = rect.top + rect.height / 2 - CARD_HEIGHT_ESTIMATE / 2
      left = rect.left - CARD_WIDTH - gap
      if (left < 16) left = rect.right + gap
      if (top < 16) top = 16
      if (top + CARD_HEIGHT_ESTIMATE > vh - 16) top = vh - CARD_HEIGHT_ESTIMATE - 16
      break
    case 'top':
      top = rect.top - CARD_HEIGHT_ESTIMATE - gap
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2
      if (left < 16) left = 16
      if (left + CARD_WIDTH > vw - 16) left = vw - CARD_WIDTH - 16
      if (top < 16) top = rect.bottom + gap
      break
  }

  return { top, left }
}

export function TourOverlay() {
  const {
    hasSeenTour,
    tourRequested,
    setHasSeenTour,
    clearTourRequest,
    settingsOpen,
    setSettingsOpen,
    setSidebarTab,
  } = useChatStore()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [cardPos, setCardPos] = useState<{ top: number | string; left: number | string; transform?: string }>({ top: 0, left: 0 })
  const [agentToken, setAgentToken] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!hasSeenTour || tourRequested) {
      setStep(0)
      setVisible(true)
    }
  }, [hasSeenTour, tourRequested])

  useEffect(() => {
    if (!visible) return
    fetch('/api/agent/tokens')
      .then((res) => (res.ok ? res.json() : []))
      .then((tokens) => {
        if (Array.isArray(tokens) && tokens.length > 0) {
          setAgentToken(tokens[0].token || '')
        }
      })
      .catch(() => {})
  }, [visible])

  const handleCopyToken = async () => {
    if (!agentToken) return
    try {
      await navigator.clipboard.writeText(agentToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const refreshRect = useCallback(() => {
    const s = STEPS[step]
    if (!s.target) {
      setTargetRect(null)
      setCardPos({ top: '10%', left: '50%', transform: 'translate(-50%, -50%)' })
      return
    }
    const el = document.querySelector(s.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
      setCardPos(getCardPosition(s, rect))
    }
  }, [step])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(refreshRect, 50)
    window.addEventListener('resize', refreshRect)
    window.addEventListener('scroll', refreshRect, true)
    const observer = new ResizeObserver(refreshRect)
    const s = STEPS[step]
    if (s.target) {
      const el = document.querySelector(s.target)
      if (el) observer.observe(el)
    }
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', refreshRect)
      window.removeEventListener('scroll', refreshRect, true)
      observer.disconnect()
    }
  }, [step, visible, refreshRect])

  useEffect(() => {
    const s = STEPS[step]
    if (s.action) s.action()
  }, [step])

  const handleNext = () => {
    if (step === 0) {
      setStep(1)
      return
    }
    if (step === 1) {
      if (!settingsOpen) setSettingsOpen(true)
      setStep(2)
      return
    }
    if (step === 3) {
      setSidebarTab('documents')
      setStep(4)
      return
    }
    if (step === 4) {
      setSettingsOpen(false)
      setStep(5)
      return
    }
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      finishTour()
    }
  }

  const handlePrev = () => {
    if (step === 2) {
      setStep(1)
      return
    }
    if (step === 4) {
      setSidebarTab('settings')
      setStep(3)
      return
    }
    if (step === 5) {
      setSettingsOpen(true)
      setSidebarTab('documents')
      setStep(4)
      return
    }
    if (step > 0) setStep((s) => s - 1)
  }

  const finishTour = () => {
    setVisible(false)
    setHasSeenTour(true)
    clearTourRequest()
  }

  if (!visible) return null

  const currentStep = STEPS[step]
  const isDialog = step === 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999]"
          style={{ pointerEvents: 'none' }}
        >
          {!isDialog && targetRect && (
            <div
              className="absolute"
              style={{
                left: targetRect.left - 6,
                top: targetRect.top - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                borderRadius: 10,
                pointerEvents: 'none',
                transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          )}

          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="absolute z-10"
            style={{
              pointerEvents: 'auto',
              top: cardPos.top,
              left: cardPos.left,
              transform: cardPos.transform,
            }}
          >
            <div className={`bg-popover border rounded-xl shadow-2xl p-5 ${isDialog ? 'w-[360px]' : 'w-80'}`}>
              <button
                onClick={finishTour}
                className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {isDialog ? (
                <div className="text-center space-y-4 py-2">
                  <div className="flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Bot className="h-7 w-7" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold">{currentStep.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {currentStep.description}
                    </p>
                  </div>

                  <ol className="space-y-3 text-left">
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        1
                      </span>
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-sm font-medium">Скачайте Агент для Windows/Mac</p>
                        <Button size="sm" variant="outline" className="h-8 w-full" asChild>
                          <a href={AGENT_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4 mr-1.5" />
                            Скачать .exe
                          </a>
                        </Button>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        2
                      </span>
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-sm font-medium">Скопируйте ваш персональный токен</p>
                        <div className="flex items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/50 px-2 py-1.5 font-mono text-xs">
                            {agentToken || '••••••••••••••••'}
                          </code>
                          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={handleCopyToken}>
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            {copied ? 'Готово' : 'Копировать'}
                          </Button>
                        </div>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        3
                      </span>
                      <p className="text-sm font-medium leading-6">
                        Вставьте токен в приложение Агента на вашем ПК и нажмите «Connect».
                      </p>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">{currentStep.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentStep.description}
                  </p>
                </div>
              )}

              <div className="flex justify-center gap-1.5 my-4">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  disabled={step === 0}
                  className="h-8"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Назад
                </Button>
                <Button size="sm" onClick={handleNext} className="h-8">
                  {step < STEPS.length - 1 ? 'Далее' : 'Завершить'}
                  {step < STEPS.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
