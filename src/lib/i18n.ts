export type Locale = 'ru' | 'en'

const translations = {
  ru: {
    nav: {
      features: 'Возможности',
      pricing: 'Тарифы',
      docs: 'Документация',
      login: 'Войти',
      start: 'Начать бесплатно',
    },
    badge: {
      text: 'Open Source • Твой AI из любой точки',
    },
    hero: {
      title: 'Твой локальный AI из любой точки',
      subtitle: 'Чат, ComfyUI, RAG — всё что работает на твоём ПК, доступно в браузере',
      description: 'Desktop Agent подключается к облачному серверу и открывает полный доступ к твоим локальным моделям, ComfyUI и документам. Без открытых портов и VPN.',
      cta: 'Начать бесплатно',
      ctaSecondary: 'Узнать больше',
    },
    features: {
      title: 'Возможности',
      subtitle: 'Один агент — весь твой локальный AI откуда угодно',
      items: [
        {
          title: 'ComfyUI Tunnel',
          description: 'Полноценный редактор нодов в браузере. Через безопасный туннель — как будто ComfyUI стоит рядом.',
          icon: 'Monitor',
        },
        {
          title: 'Desktop Agent',
          description: 'Один Electron-агент для чата, генерации, ComfyUI-туннеля и RAG. Сел и забыл.',
          icon: 'Download',
        },
        {
          title: 'Доступ откуда угодно',
          description: 'Никаких open ports, ngrok или VPN. Агент сам выходит на связь через Socket.IO.',
          icon: 'Globe',
        },
        {
          title: 'RAG Pipeline',
          description: 'Загружай документы, векторизуй и получай ответы на основе своих данных.',
          icon: 'Database',
        },
        {
          title: 'Multi-Model',
          description: 'Qwen, Llama, Mistral — любые модели через Ollama или LM Studio.',
          icon: 'Bot',
        },
        {
          title: 'Open Source',
          description: 'Полностью открытый код. Форкни, разверни, доработай как хочешь.',
          icon: 'Code',
        },
      ],
    },
    howItWorks: {
      title: 'Как это работает',
      subtitle: '4 шага до своего AI из любой точки',
      steps: [
        {
          title: 'Установи Ollama / ComfyUI',
          description: 'Загрузи LLM через Ollama или LM Studio. Если нужно — запусти ComfyUI для генерации изображений.',
        },
        {
          title: 'Запусти Desktop Agent',
          description: 'Установи Electron-агент на свой ПК и укажи токен доступа.',
        },
        {
          title: 'Подключись к SaaS',
          description: 'Агент сам выходит на связь с облачным сервером через Socket.IO. Никаких портов наружу.',
        },
        {
          title: 'Пользуйся с любого устройства',
          description: 'Открывай браузер на телефоне, планшете или ноутбуке — чат, генерация, ComfyUI, RAG. Всё доступно.',
        },
      ],
    },
    pricing: {
      title: 'Тарифы',
      subtitle: 'Бесплатно для большинства. Pro — для тех, кто хочет поддержать проект.',
      monthly: 'Ежемесячно',
      yearly: 'Ежегодно',
      savePercent: 'скидка {p}%',
      plans: [
        {
          name: 'Free',
          price: '$0',
          period: '',
          description: 'Покрывает 99% сценариев',
          features: ['ComfyUI туннель', '10 документов', '30 сессий', '3 токена агента', '10 генераций', '30 запросов/мин'],
          cta: 'Начать бесплатно',
          popular: false,
        },
        {
          name: 'Pro',
          priceMonthly: '$5',
          priceYearly: '$50',
          periodMonthly: '/мес',
          periodYearly: '/год',
          description: 'Для активных пользователей',
          features: ['ComfyUI туннель', '50 документов', 'Безлимитные сессии', '10 токенов агента', '100 генераций', '120 запросов/мин', 'Поддержка автора'],
          cta: 'Выбрать Pro',
          popular: true,
        },
      ],
    },
    faq: {
      title: 'Часто задаваемые вопросы',
      items: [
        {
          question: 'Что такое EdgeChat?',
          answer: 'EdgeChat — это мост между твоим браузером и AI, который работает на твоём компьютере. Чат, ComfyUI, RAG с документами — через один Desktop Agent. Данные остаются на твоей машине.',
        },
        {
          question: 'ComfyUI работает через браузер? Как быстро?',
          answer: 'Полный редактор ComfyUI доступен по адресу /comfyui/. Все ноды, превью и WebSocket в реальном времени. Статика кэшируется браузером, редактор отзывчив даже через 4G.',
        },
        {
          question: 'Зачем платить Pro, если Free всё включает?',
          answer: 'Free покрывает почти всё: 10 документов, 30 сессий, 10 генераций, ComfyUI без лимитов. Pro снимает лимиты и помогает проекту жить. По сути это донат.',
        },
        {
          question: 'Нужен ли мощный сервер или VPS?',
          answer: 'Нет. Вся работа идёт на твоём локальном ПК через Ollama, LM Studio или ComfyUI. VPS или облако нужны только для веб-интерфейса.',
        },
        {
          question: 'Какие модели поддерживаются?',
          answer: 'Любые модели через Ollama или LM Studio: Qwen, Llama, Mistral, Gemma и другие. Всё что работает локально — работает и через EdgeChat.',
        },
        {
          question: 'Безопасно ли это?',
          answer: 'Да. Чат не хранит сообщения в облаке. Токен агента используется только для подключения. Все данные остаются на твоём компьютере.',
        },
        {
          question: 'Как начать?',
          answer: 'Установи Ollama или LM Studio, запусти Desktop Agent, укажи токен и URL сервера — и готово. Весь процесс занимает пару минут.',
        },
      ],
    },
    footer: {
      description: 'Твой локальный AI из любой точки. Open Source.',
      product: 'Продукт',
      company: 'Компания',
      legal: 'Юридическая',
      features: 'Возможности',
      pricing: 'Тарифы',
      docs: 'Документация',
      blog: 'Блог',
      about: 'О нас',
      contact: 'Контакты',
      privacy: 'Политика конфиденциальности',
      terms: 'Условия использования',
      copyright: '© 2026 EdgeChat. Все права защищены.',
    },
  },
  en: {
    nav: {
      features: 'Features',
      pricing: 'Pricing',
      docs: 'Docs',
      login: 'Log in',
      start: 'Get Started',
    },
    badge: {
      text: 'Open Source • Your AI From Anywhere',
    },
    hero: {
      title: 'Your Local AI, Anywhere',
      subtitle: 'Chat, ComfyUI, RAG — everything running on your PC, available in the browser',
      description: 'Desktop Agent connects to the cloud and gives you full access to your local models, ComfyUI, and documents. No open ports or VPN needed.',
      cta: 'Get Started Free',
      ctaSecondary: 'Learn More',
    },
    features: {
      title: 'Features',
      subtitle: 'One agent — your entire local AI stack, from anywhere',
      items: [
        {
          title: 'ComfyUI Tunnel',
          description: 'Full ComfyUI editor in the browser. Through a secure tunnel — feels like it is running locally.',
          icon: 'Monitor',
        },
        {
          title: 'Desktop Agent',
          description: 'Single Electron agent for chat, image gen, ComfyUI tunnel, and RAG. Set it and forget it.',
          icon: 'Download',
        },
        {
          title: 'Access from Anywhere',
          description: 'No open ports, ngrok, or VPN. The agent connects outbound via Socket.IO.',
          icon: 'Globe',
        },
        {
          title: 'RAG Pipeline',
          description: 'Upload documents, vectorize, and get answers grounded in your own data.',
          icon: 'Database',
        },
        {
          title: 'Multi-Model',
          description: 'Qwen, Llama, Mistral — any model via Ollama or LM Studio.',
          icon: 'Bot',
        },
        {
          title: 'Open Source',
          description: 'Fully open source. Fork it, deploy it, tweak it however you want.',
          icon: 'Code',
        },
      ],
    },
    howItWorks: {
      title: 'How It Works',
      subtitle: '4 steps to your AI from anywhere',
      steps: [
        {
          title: 'Install Ollama / ComfyUI',
          description: 'Load a model via Ollama or LM Studio. Run ComfyUI for image generation if needed.',
        },
        {
          title: 'Launch Desktop Agent',
          description: 'Install the Electron agent on your PC and enter your access token.',
        },
        {
          title: 'Connect to SaaS',
          description: 'The agent connects to the cloud outbound via Socket.IO. No ports to open.',
        },
        {
          title: 'Use from Any Device',
          description: 'Open a browser on your phone, tablet, or laptop — chat, generation, ComfyUI, RAG. All there.',
        },
      ],
    },
    pricing: {
      title: 'Pricing',
      subtitle: 'Free for most. Pro is for those who want to support the project.',
      monthly: 'Monthly',
      yearly: 'Yearly',
      savePercent: 'save {p}%',
      plans: [
        {
          name: 'Free',
          price: '$0',
          period: '',
          description: 'Covers 99% of use cases',
          features: ['ComfyUI tunnel', '10 documents', '30 sessions', '3 agent tokens', '10 generations', '30 requests/min'],
          cta: 'Get Started Free',
          popular: false,
        },
        {
          name: 'Pro',
          priceMonthly: '$5',
          priceYearly: '$50',
          periodMonthly: '/mo',
          periodYearly: '/yr',
          description: 'For heavy users',
          features: ['ComfyUI tunnel', '50 documents', 'Unlimited sessions', '10 agent tokens', '100 generations', '120 requests/min', 'Support the author'],
          cta: 'Choose Pro',
          popular: true,
        },
      ],
    },
    faq: {
      title: 'Frequently Asked Questions',
      items: [
        {
          question: 'What is EdgeChat?',
          answer: 'EdgeChat is a bridge between your browser and the AI running on your computer. Chat, ComfyUI, RAG — all through one Desktop Agent. Your data stays on your machine.',
        },
        {
          question: 'Does ComfyUI work in the browser? Is it fast?',
          answer: 'The full ComfyUI editor is available at /comfyui/. All nodes, previews, and real-time WebSocket. Static assets are cached, the editor stays responsive even on 4G.',
        },
        {
          question: 'Why pay for Pro if Free has everything?',
          answer: 'Free covers almost everything: 10 documents, 30 sessions, 10 generations, unlimited ComfyUI. Pro lifts the limits and supports the project — basically a donation.',
        },
        {
          question: 'Do I need a powerful server or VPS?',
          answer: 'No. All processing runs on your local PC via Ollama, LM Studio, or ComfyUI. A VPS is only needed to host the web interface.',
        },
        {
          question: 'Which models are supported?',
          answer: 'Any model available through Ollama or LM Studio: Qwen, Llama, Mistral, Gemma, and more. If it runs locally, it works with EdgeChat.',
        },
        {
          question: 'Is it secure?',
          answer: 'Yes. Chat messages are not stored in the cloud. Agent tokens are only used for authentication. All data stays on your computer.',
        },
        {
          question: 'How to get started?',
          answer: 'Install Ollama or LM Studio, launch the Desktop Agent, enter your token and server URL — and you are done. Takes a couple of minutes.',
        },
      ],
    },
    footer: {
      description: 'Your local AI, anywhere. Open Source.',
      product: 'Product',
      company: 'Company',
      legal: 'Legal',
      features: 'Features',
      pricing: 'Pricing',
      docs: 'Docs',
      blog: 'Blog',
      about: 'About',
      contact: 'Contact',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      copyright: '© 2026 EdgeChat. All rights reserved.',
    },
  },
} as const

export function t(locale: Locale) {
  return translations[locale] || translations.ru
}
