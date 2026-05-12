// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string }>
import { GoogleGenAI } from '@google/genai'

const SYSTEM_PROMPT =
  'Tóm tắt nội dung workshop sau bằng tiếng Việt, 2-3 đoạn ngắn, tập trung vào mục tiêu và nội dung chính.'
const MAX_TOKENS = 4000
const REPEATED_LINE_MIN = 4
const REPEATED_LINE_MAX = 80

export class PDFDownloadError extends Error {
  constructor(message = 'Failed to download PDF') {
    super(message)
    this.name = 'PDFDownloadError'
  }
}

export class PDFExtractError extends Error {
  constructor(message = 'Failed to extract PDF text') {
    super(message)
    this.name = 'PDFExtractError'
  }
}

export class PDFEmptyError extends Error {
  constructor(message = 'PDF không có text layer') {
    super(message)
    this.name = 'PDFEmptyError'
  }
}

export class GeminiSummarizeError extends Error {
  constructor(message = 'Gemini summarization failed') {
    super(message)
    this.name = 'GeminiSummarizeError'
  }
}

// Heuristic to drop repeated headers/footers before normalization.
function stripRepeatedLines(text: string): string {
  const lines = text.split(/\r?\n/)
  const counts = new Map<string, number>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length < REPEATED_LINE_MIN || trimmed.length > REPEATED_LINE_MAX) continue
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1)
  }

  const threshold = Math.max(3, Math.ceil(lines.length * 0.2))
  const repeated = new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([line]) => line)
  )

  if (repeated.size === 0) return text
  return lines.filter((line) => !repeated.has(line.trim())).join('\n')
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim()
}

function truncateTokens(text: string, maxTokens: number): { text: string; truncated: boolean } {
  const tokens = text.split(/\s+/)
  if (tokens.length <= maxTokens) return { text, truncated: false }
  return { text: tokens.slice(0, maxTokens).join(' '), truncated: true }
}

export class PDFDownloadFilter {
  async run(pdfUrl: string): Promise<Buffer> {
    const res = await fetch(pdfUrl)
    if (!res.ok) {
      throw new PDFDownloadError(`Failed to fetch PDF (${res.status})`)
    }
    const data = await res.arrayBuffer()
    return Buffer.from(data)
  }
}

export class PDFExtractFilter {
  async run(buffer: Buffer): Promise<string> {
    let rawText = ''
    try {
      const parsed = await pdfParse(buffer)
      rawText = parsed.text ?? ''
    } catch {
      throw new PDFExtractError('PDF parse failed')
    }

    const cleaned = normalizeWhitespace(stripRepeatedLines(rawText))
    if (!cleaned.trim()) {
      throw new PDFEmptyError()
    }

    const { text, truncated } = truncateTokens(cleaned, MAX_TOKENS)
    if (truncated) {
      console.warn('[AISummaryPipeline] Truncated PDF text to 4000 tokens')
    }
    return text
  }
}

export class GeminiSummarizeFilter {
  private readonly ai: GoogleGenAI

  constructor(apiKey: string | undefined = process.env.GEMINI_API_KEY) {
    if (!apiKey) throw new GeminiSummarizeError('Missing GEMINI_API_KEY')
    this.ai = new GoogleGenAI({ apiKey })
  }

  async run(text: string): Promise<string> {
    try {
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: text,
        config: { systemInstruction: SYSTEM_PROMPT },
      })
      const summary = result.text?.trim() ?? ''
      if (!summary) {
        throw new GeminiSummarizeError('Gemini returned empty summary')
      }
      return summary
    } catch (err) {
      if (err instanceof GeminiSummarizeError) throw err
      const detail = err instanceof Error ? err.message : String(err)
      throw new GeminiSummarizeError(`Gemini summarization failed: ${detail}`)
    }
  }
}

export class AISummaryPipeline {
  constructor(
    private readonly downloadFilter = new PDFDownloadFilter(),
    private readonly extractFilter = new PDFExtractFilter(),
    private readonly summarizeFilter = new GeminiSummarizeFilter()
  ) {}

  async run(pdfUrl: string): Promise<string> {
    const buffer = await this.downloadFilter.run(pdfUrl)
    const text = await this.extractFilter.run(buffer)
    return this.summarizeFilter.run(text)
  }
}
