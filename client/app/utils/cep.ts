interface RespostaViaCep {
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

export interface EnderecoPorCep {
  logradouro: string
  bairro: string
  cidade: string
  estado: string
}

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoPorCep | null> {
  const digitos = cep.replace(/\D/g, '')
  if (digitos.length !== 8) return null

  try {
    const res = await $fetch<RespostaViaCep>(`https://viacep.com.br/ws/${digitos}/json/`)
    if (!res || res.erro) return null

    return {
      logradouro: res.logradouro || '',
      bairro: res.bairro || '',
      cidade: res.localidade || '',
      estado: res.uf || ''
    }
  } catch {
    return null
  }
}
