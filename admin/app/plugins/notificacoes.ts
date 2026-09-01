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

  const solicitarPermissao = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission()
        } catch (e) {}
      }
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (e) {}
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

  return {
    provide: {
      notificacoes: {
        solicitarPermissao,
        dispararNotificacaoPush,
        conectarStream,
      },
    },
  }
})
