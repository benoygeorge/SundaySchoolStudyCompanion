const defaultRecaptchaSiteKey = '6LeDW1gsAAAAAOyR_CoPacHiUN6ie39tP7Dp88Ik'
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || defaultRecaptchaSiteKey
const recaptchaDisabled = import.meta.env.VITE_DISABLE_RECAPTCHA === 'true'
const recaptchaTimeoutMs = 8000

type GrecaptchaEnterprise = {
  ready: (callback: () => void) => void
  execute: (siteKey: string, options: { action: string }) => Promise<string>
  reset?: () => void
}

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: GrecaptchaEnterprise
    }
  }
}

let loadPromise: Promise<void> | null = null

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`Security verification ${label} timed out.`))
    }, recaptchaTimeoutMs)

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId))
  })
}

function removeRecaptchaScript(): void {
  document.querySelectorAll<HTMLScriptElement>('script[data-recaptcha-enterprise="true"]').forEach((script) => script.remove())
  window.grecaptcha = undefined
  loadPromise = null
}

function loadRecaptchaScript(forceReload = false): Promise<void> {
  if (forceReload) {
    removeRecaptchaScript()
  }

  if (!forceReload && window.grecaptcha?.enterprise?.execute) {
    return Promise.resolve()
  }

  if (!forceReload && loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-recaptcha-enterprise="true"]')

    if (existingScript) {
      if (window.grecaptcha?.enterprise?.ready) {
        resolve()
        return
      }

      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Security verification could not load. Please refresh the page and try again.')), { once: true })
      return
    }

    const script = document.createElement('script')
    const reloadTag = forceReload ? `&reload=${Date.now()}` : ''
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(recaptchaSiteKey)}${reloadTag}`
    script.async = true
    script.defer = true
    script.setAttribute('data-recaptcha-enterprise', 'true')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Security verification could not load. Please refresh the page and try again.'))
    document.head.appendChild(script)
  })

  return loadPromise
}

function waitForRecaptchaReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const enterprise = window.grecaptcha?.enterprise

    if (!enterprise?.ready) {
      reject(new Error('Security verification is not ready. Please refresh the page and try again.'))
      return
    }

    enterprise.ready(() => {
      if (window.grecaptcha?.enterprise?.execute) {
        resolve()
        return
      }

      reject(new Error('Security verification is not ready. Please refresh the page and try again.'))
    })
  })
}

async function executeRecaptcha(forceReload = false): Promise<string> {
  await withTimeout(loadRecaptchaScript(forceReload), 'load')
  await withTimeout(waitForRecaptchaReady(), 'ready')

  const token = await withTimeout(window.grecaptcha?.enterprise?.execute(recaptchaSiteKey, { action: 'LOGIN' }) ?? Promise.resolve(undefined), 'execute')

  if (!token) {
    throw new Error('Security verification did not return a token.')
  }

  return token
}

export async function getLoginRecaptchaToken(): Promise<string | undefined> {
  if (recaptchaDisabled) {
    return undefined
  }

  try {
    return await executeRecaptcha()
  } catch (error) {
    console.warn('Study Companion reCAPTCHA failed; retrying with a fresh script', {
      reason: errorMessage(error)
    })
  }

  try {
    return await executeRecaptcha(true)
  } catch (error) {
    console.warn('Study Companion reCAPTCHA unavailable; attempting login without token', {
      reason: errorMessage(error)
    })
    window.grecaptcha?.enterprise?.reset?.()
    return undefined
  }
}
