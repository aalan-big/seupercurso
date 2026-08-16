const GRADIENTES = ['from-primary to-secondary', 'from-secondary to-accent', 'from-primary to-accent']

export function gradientePorId(id: string) {
  const soma = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTES[soma % GRADIENTES.length]
}
