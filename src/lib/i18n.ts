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
    hero: {
      title: 'Приватный AI-ассистент',
      subtitle: 'Ваши данные. Ваши модели. Никакого облака.',
      description: 'EdgeChat подключает вас к локальным LLM через Desktop Agent. Полная приватность, встроенный RAG, без ограничений API.',
      cta: 'Начать бесплатно',
      ctaSecondary: 'Узнать больше',
    },
    features: {
      title: 'Возможности',
      subtitle: 'Всё что нужно для приватного AI',
      items: [
        {
          title: 'Полная приватность',
          description: 'Данные не покидают ваш компьютер. Никакого облака, никаких API-ключей.',
          icon: 'Shield',
        },
        {
          title: 'RAG-пайплайн',
          description: 'Загружайте документы, векторизуйте и получайте ответы на основе ваших данных.',
          icon: 'Database',
        },
        {
          title: 'Desktop Agent',
          description: 'WebSocket-мост между SaaS и вашим локальным LLM. Без проброса портов.',
          icon: 'Monitor',
        },
        {
          title: 'Системные промпты',
          description: '6 дефолтных + кастомные промпты для любых задач.',
          icon: 'Sparkles',
        },
        {
          title: 'Мульти-модель',
          description: 'Qwen, Llama, Mistral, Claude — любые модели через Ollama или LM Studio.',
          icon: 'Bot',
        },
        {
          title: 'Open Source',
          description: 'Полностью открытый код. Разверните на своём сервере.',
          icon: 'Code',
        },
      ],
    },
    howItWorks: {
      title: 'Как это работает',
      subtitle: '4 простых шага до приватного AI',
      steps: [
        {
          title: 'Установите LLM',
          description: 'Скачайте Ollama или LM Studio и загрузите модель.',
        },
        {
          title: 'Запустите Agent',
          description: 'Установите Desktop Agent на свой компьютер.',
        },
        {
          title: 'Подключитесь',
          description: 'Укажите URL сервера и токен в Agent.',
        },
        {
          title: 'Начнайте общаться',
          description: 'Отправляйте сообщения и получайте ответы от вашей модели.',
        },
      ],
    },
    pricing: {
      title: 'Тарифы',
      subtitle: 'Выберите план под свои задачи',
      plans: [
        {
          name: 'Free',
          price: '$0',
          period: '/мес',
          description: 'Для ознакомления',
          features: ['3 документа', '10 сессий', 'Дефолтные промпты'],
          cta: 'Начать бесплатно',
          popular: false,
        },
        {
          name: 'Pro',
          price: '$5',
          period: '/мес',
          description: 'Для профессионалов',
          features: ['50 документов', 'Безлимитные сессии', 'Кастомные промпты', 'Экспорт'],
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
          answer: 'EdgeChat — это приватный AI-ассистент, который подключает вас к локальным LLM через Desktop Agent. Ваши данные остаются на вашем компьютере.',
        },
        {
          question: 'Нужен ли мощный сервер?',
          answer: 'Нет. EdgeChat работает как прокси — LLM запускается на вашем локальном компьютере через Ollama или LM Studio. VPS нужен только для веб-интерфейса.',
        },
        {
          question: 'Какие модели поддерживаются?',
          answer: 'Любые модели, доступные в Ollama или LM Studio: Qwen, Llama, Mistral, Claude, Gemma и другие.',
        },
        {
          question: 'Безопасны ли мои данные?',
          answer: 'Да. EdgeChat не хранит ваши сообщения в облаке. Все данные остаются на вашем компьютере или вашем VPS.',
        },
        {
          question: 'Можно ли использовать оффлайн?',
          answer: 'Да, если у вас есть локальный LLM. EdgeChat работает полностью оффлайн без доступа в интернет.',
        },
        {
          question: 'Как начать?',
          answer: 'Установите Ollama или LM Studio, запустите Desktop Agent, подключитесь к серверу и начнайте общаться.',
        },
      ],
    },
    footer: {
      description: 'Приватный AI-ассистент для тех, кто ценит конфиденциальность.',
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
    hero: {
      title: 'Private AI Assistant',
      subtitle: 'Your data. Your models. No cloud.',
      description: 'EdgeChat connects you to local LLMs via Desktop Agent. Full privacy, built-in RAG, no API limits.',
      cta: 'Get Started Free',
      ctaSecondary: 'Learn More',
    },
    features: {
      title: 'Features',
      subtitle: 'Everything you need for private AI',
      items: [
        {
          title: 'Full Privacy',
          description: 'Data never leaves your computer. No cloud, no API keys.',
          icon: 'Shield',
        },
        {
          title: 'RAG Pipeline',
          description: 'Upload documents, vectorize, and get answers based on your data.',
          icon: 'Database',
        },
        {
          title: 'Desktop Agent',
          description: 'WebSocket bridge between SaaS and your local LLM. No port forwarding.',
          icon: 'Monitor',
        },
        {
          title: 'System Prompts',
          description: '6 default + custom prompts for any task.',
          icon: 'Sparkles',
        },
        {
          title: 'Multi-Model',
          description: 'Qwen, Llama, Mistral, Claude — any model via Ollama or LM Studio.',
          icon: 'Bot',
        },
        {
          title: 'Open Source',
          description: 'Fully open source. Deploy on your own server.',
          icon: 'Code',
        },
      ],
    },
    howItWorks: {
      title: 'How It Works',
      subtitle: '4 simple steps to private AI',
      steps: [
        {
          title: 'Install LLM',
          description: 'Download Ollama or LM Studio and load a model.',
        },
        {
          title: 'Launch Agent',
          description: 'Install Desktop Agent on your computer.',
        },
        {
          title: 'Connect',
          description: 'Enter server URL and token in the Agent.',
        },
        {
          title: 'Start Chatting',
          description: 'Send messages and get responses from your model.',
        },
      ],
    },
    pricing: {
      title: 'Pricing',
      subtitle: 'Choose a plan that fits your needs',
      plans: [
        {
          name: 'Free',
          price: '$0',
          period: '/mo',
          description: 'For getting started',
          features: ['3 documents', '10 sessions', 'Default prompts'],
          cta: 'Get Started Free',
          popular: false,
        },
        {
          name: 'Pro',
          price: '$5',
          period: '/mo',
          description: 'For professionals',
          features: ['50 documents', 'Unlimited sessions', 'Custom prompts', 'Export'],
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
          answer: 'EdgeChat is a private AI assistant that connects you to local LLMs via Desktop Agent. Your data stays on your computer.',
        },
        {
          question: 'Do I need a powerful server?',
          answer: 'No. EdgeChat works as a proxy — the LLM runs on your local computer via Ollama or LM Studio. A VPS is only needed for the web interface.',
        },
        {
          question: 'Which models are supported?',
          answer: 'Any model available in Ollama or LM Studio: Qwen, Llama, Mistral, Claude, Gemma, and more.',
        },
        {
          question: 'Is my data safe?',
          answer: 'Yes. EdgeChat does not store your messages in the cloud. All data stays on your computer or your VPS.',
        },
        {
          question: 'Can I use it offline?',
          answer: 'Yes, if you have a local LLM. EdgeChat works completely offline without internet access.',
        },
        {
          question: 'How to get started?',
          answer: 'Install Ollama or LM Studio, launch Desktop Agent, connect to the server, and start chatting.',
        },
      ],
    },
    footer: {
      description: 'Private AI assistant for those who value privacy.',
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
