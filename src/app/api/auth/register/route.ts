import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не менее 6 символов' }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Пользователь уже существует' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await db.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
      },
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
