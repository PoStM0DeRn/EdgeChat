'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/lib/store'

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
      'Этот тур покажет основные возможности. Вы сможете подключить Desktop-Агент, настроить токен и начать общение с локальной LLM.',
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
): { top: number; left: number; transform?: string } {
  if (!step.target || !rect) {
    return { top: 0, left: 0, transform: 'translate(-50%, -50%)' }
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
  const { hasSeenTour, settingsOpen, setHasSeenTour, setSettingsOpen, setSidebarTab } =
    useChatStore()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [cardPos, setCardPos] = useState({ top: 0, left: 0, transform: undefined as string | undefined })

  useEffect(() => {
    if (!hasSeenTour) {
      setVisible(true)
    }
  }, [hasSeenTour])

  const refreshRect = useCallback(() => {
    const s = STEPS[step]
    if (!s.target) {
      setTargetRect(null)
      setCardPos({ top: 0, left: 0, transform: 'translate(-50%, -50%)' })
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
            <div className="bg-popover border rounded-xl shadow-2xl p-5 w-80">
              <button
                onClick={finishTour}
                className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {isDialog ? (
                <div className="text-center space-y-3 py-4">
                  <div className="flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Bot className="h-7 w-7" />
                    </div>
                  </div>
                  <h2 className="text-lg font-semibold">{currentStep.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentStep.description}
                  </p>
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
