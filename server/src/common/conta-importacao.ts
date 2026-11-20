/**
 * Conta interna que guarda as inscricoes importadas de outro site ate o atleta
 * entrar no Seu Percurso com o mesmo CPF (ai a inscricao passa para a conta
 * dele). Ninguem entra nela: senha aleatoria, usuario e cliente INATIVOS. O
 * dominio .interno nao existe, entao nenhum e-mail sai para ela.
 */
export const EMAIL_CONTA_IMPORTACAO = 'importacao@sistema.seupercurso.interno';
