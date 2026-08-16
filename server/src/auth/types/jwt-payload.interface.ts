export interface JwtPayload {
  sub: string;
  email: string;
  // Tokens de admin/staff levam esse campo — um token de usuário comum nunca tem.
  // A JwtStrategy rejeita qualquer payload que traga isso, pra um token de outra
  // identidade (admin/staff) nunca ser aceito nas rotas de client/organizer.
  tipo?: string;
}
