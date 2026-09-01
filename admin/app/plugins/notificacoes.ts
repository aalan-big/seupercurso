export default defineNuxtPlugin(() => {
  const toastNotificacao = useState<any>('toastNotificacao', () => null)

  if (import.meta.server) {
    return {
      provide: {
        notificacoes: {
          solicitarPermissao: () => {},
          dispararNotificacaoPush: () => {},
          conectarStream: () => {},
        },
      },
    }
  }

  const config = useRuntimeConfig()
  const token = useCookie<string | null>('rotapass_admin_token', { default: () => null })

  const getApiBase = () => {
    let base = (config.public.apiBase as string) || 'http://localhost:3000'
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      base = 'https://api.seupercurso.esp.br'
    }
    return base
  }

  function urlB64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const solicitarPermissao = async () => {
    if (typeof window === 'undefined') return

    let permissao = 'default'
    if ('Notification' in window) {
      try {
        permissao = await Notification.requestPermission()
      } catch (e) {}
    }

    if (permissao === 'granted' && 'serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready

        const baseURL = getApiBase()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token.value) headers.Authorization = `Bearer ${token.value}`

        const res = await fetch(`${baseURL}/admin/push/public-key`, { headers })
        if (res.ok) {
          const { publicKey } = await res.json()
          if (publicKey) {
            let subscription = await reg.pushManager.getSubscription()
            if (!subscription) {
              subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlB64ToUint8Array(publicKey),
              })
            }

            if (subscription) {
              await fetch(`${baseURL}/admin/push/inscrever`, {
                method: 'POST',
                headers,
                body: JSON.stringify(subscription),
              })
            }
          }
        }
      } catch (e) {
        console.warn('Erro ao registrar Web Push nativo:', e)
      }
    }
  }

  const dispararNotificacaoPush = (valorTaxa: number) => {
    const valorFormatado = valorTaxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    toastNotificacao.value = {
      id: Date.now(),
      valorFormatado,
      criadoEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }

    setTimeout(() => {
      toastNotificacao.value = null
    }, 6000)

    // Vibração no celular
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200, 100, 300])
      } catch (e) {}
    }

    // 1. Notificação Nativa do Sistema Operacional (Barra Nativa do Celular via Service Worker)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification('Seu Percurso', {
            body: `Nova comissão recebida: ${valorFormatado}`,
            icon: '/icone_notificacao.jpg',
            badge: '/icone_notificacao.jpg',
            vibrate: [200, 100, 200, 100, 200],
            tag: `comissao_${Date.now()}`,
          } as any)
        }).catch(() => {
          try {
            new Notification('Seu Percurso', {
              body: `Nova comissão recebida: ${valorFormatado}`,
              icon: '/icone_notificacao.jpg',
              badge: '/icone_notificacao.jpg',
            })
          } catch (e) {}
        })
      } else {
        try {
          new Notification('Seu Percurso', {
            body: `Nova comissão recebida: ${valorFormatado}`,
            icon: '/icone_notificacao.jpg',
            badge: '/icone_notificacao.jpg',
          })
        } catch (e) {}
      }
    }

    // Som de Caixa Registradora / Moedas
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime)
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.4)
    } catch (e) {}
  }

  const conectarStream = () => {
    if (!token.value || eventSource) return

    const baseURL = getApiBase()
    const tokenParam = token.value ? `?token=${encodeURIComponent(token.value)}` : ''
    const sseUrl = `${baseURL}/admin/notificacoes-stream${tokenParam}`

    try {
      eventSource = new EventSource(sseUrl)
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data && data.valorTaxa) {
            dispararNotificacaoPush(Number(data.valorTaxa))
          }
        } catch (e) {}
      }

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close()
          eventSource = null
          setTimeout(conectarStream, 5000)
        }
      }
    } catch (e) {}
  }

  let lastCheckTime = Date.now()
  const checarNotificacoesFallback = async () => {
    if (!token.value) return
    try {
      const baseURL = getApiBase()
      const res = await fetch(`${baseURL}/admin/notificacoes-historico`, {
        headers: { Authorization: `Bearer ${token.value}` },
      })
      if (res.ok) {
        const historico = await res.json()
        if (Array.isArray(historico)) {
          for (const item of historico) {
            const itemTime = new Date(item.criadoEm).getTime()
            if (itemTime > lastCheckTime) {
              dispararNotificacaoPush(Number(item.valorTaxa))
            }
          }
        }
      }
    } catch (e) {}
    lastCheckTime = Date.now()
  }

  setInterval(checarNotificacoesFallback, 8000)

  const testarNotificacaoBackend = async (valorTaxa = 15.0) => {
    dispararNotificacaoPush(valorTaxa)
    await solicitarPermissao()
    try {
      const baseURL = getApiBase()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token.value) headers.Authorization = `Bearer ${token.value}`
      await fetch(`${baseURL}/admin/testar-notificacao`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ valorTaxa }),
      })
    } catch (e) {}
  }

  return {
    provide: {
      notificacoes: {
        solicitarPermissao,
        dispararNotificacaoPush,
        testarNotificacaoBackend,
        conectarStream,
      },
    },
  }
})
