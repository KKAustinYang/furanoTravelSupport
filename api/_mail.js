// チケット内容をメールで送る（SMTP）。
//
// 送信元は「こちらが送信権限を持つアドレス」に固定し、フォームに入力された
// お客様のアドレスは Reply-To と表示名に入れる。入力値をそのまま From にすると
// SPF/DKIM/DMARC で弾かれ、Gmail では届かない（迷惑メール行きか受信拒否）。
// 受信側の AI が自動返信すれば、Reply-To 宛＝お客様に返る。
//
// 環境変数（Vercel → Settings → Environment Variables）:
//   SMTP_USER       送信に使うアカウント（例: aurora.mobile.developer@gmail.com）
//   SMTP_PASS       アプリパスワード（Gmail の通常パスワードでは送れない）
//   MAIL_TO         宛先。既定は aurora.mobile.developer@gmail.com
//   SMTP_HOST       既定 smtp.gmail.com
//   SMTP_PORT       既定 465（SSL）
//   MAIL_FROM       差出人アドレス。既定は SMTP_USER

import nodemailer from 'nodemailer'

const MAX_ATTACH_BYTES = 4 * 1024 * 1024

function must(name) {
  const v = (process.env[name] || '').trim()
  if (!v) throw new Error(`${name} is not configured on the server.`)
  return v
}

// 表示名にヘッダを壊す文字が混ざらないようにする（改行・引用符）
function safeName(s) {
  return String(s || '').replace(/[\r\n"<>]/g, ' ').trim().slice(0, 80)
}

function validEmail(s) {
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(s || '').trim())
}

export async function sendTicketMail(body) {
  const user = must('SMTP_USER')
  const pass = must('SMTP_PASS')
  const to = (process.env.MAIL_TO || 'aurora.mobile.developer@gmail.com').trim()
  const from = (process.env.MAIL_FROM || user).trim()

  const subject = String(body.subject || '（件名なし）').replace(/[\r\n]/g, ' ').slice(0, 200)
  const text = String(body.text || '')
  if (!text) throw new Error('本文が空です')

  const replyTo = validEmail(body.replyTo) ? String(body.replyTo).trim() : ''
  const who = safeName(body.name)

  // 送信元の表示名にお客様の氏名とアドレスを出す（誰からの起票かひと目で分かる）
  const label = [who, replyTo && `<${replyTo}>`].filter(Boolean).join(' ') || 'QNAP サポートポータル デモ'

  const attachments = []
  let total = 0
  for (const f of Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : []) {
    if (!f || !f.base64 || !f.name) continue
    const buf = Buffer.from(f.base64, 'base64')
    total += buf.length
    if (total > MAX_ATTACH_BYTES) break
    attachments.push({ filename: safeName(f.name) || 'attachment', content: buf })
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user, pass },
  })

  const info = await transporter.sendMail({
    from: { name: `${label}（QNAP サポートポータル デモ）`, address: from },
    to,
    replyTo: replyTo || undefined,
    subject: `[サポートチケット] ${subject}`,
    text,
    attachments,
  })

  return { id: info.messageId, to, replyTo, attachments: attachments.length }
}
