import type { Context, Next } from 'hono'
import { getEnv } from '../config/env'
import { getDownloadUrlHandler } from '../controllers/documento.controller'

const MUTATIVE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Rotas mutativas sem verificação de origem.
 * 
 * `/api/auth/login` ESTAVA aqui e foi removido. A justificativa original era
 * que rotas públicas "não necessitam de verificação CSRF baseada em sessão" -
 * o que é verdade para um mecanismo com token de sessão, mas não descreve este
 * middleware, que valida exclusivamente a ORIGEM da requisição e naõ depende
 * de sessão alguma. Nada impedia o login de ser protegido antes da 
 * autenticação, e a isençaõ abria login-CSRF: um site externo podia forçar a 
 * vitima a entrar na conta do atacante e seguir operando dentro dela.
 * 
 * As duas que permanecem não têm equivalente desse rico:
 *    -`/api/contato`: formulário público do site. Força-lo produz uma mensagem
 *    de contato indesejada, sem privilégio, sem sessão e sem efeito sobre a 
 *    conta de quem foi induzido;
 *    - `api/auth/recuperar-senha` : dispara e-mail para o endereço infprmado no
 *    corpo. Forçá-lo não altera nada na conta da vitima sem revela se ela
 *    existe, e a rota tem limite de 3 por minuto.
 */
const CSRF_EXEMPT_PATHS = new set(['/api/contato', '/api/auth/recuperar-senha'])

/**
 * Decide se uma origem é confiável
 * Comparação SEMÂNTICA e por igualdade, nunca por substring. `URL().origin`
 * normaliza esquema, host  e porta, de modo que `http` não passa por `https´,
 * `:3131` não passa por `:3130` e `http://localhost.exemplo=atacante.com` não
 * passa por `http://localhost:3130`. A fonte de verdade é `ÀLLOWED_ORIGINS`,
 * mais a origin da própria requisição - não existe segunda lista.
 */
function origemConfiavel(origem: string, proprioOrigin: string, permitidas: string[]): boolean {
    let normalizada: string
    try {
        normalizada = new URL(origem).origin
    } catch {
        // origin malformada não é confiavel.
        return false
    }
    if (normalizada === 'null') return false

    const naLista = permitidas.some((permitida) => {
        try {
            return new URL(permitida).origin === normalizada
        } catch {
            return false
        }
    })
    if (naLista) return true

    // Mesma origem da própria requisição: é o que mantém o desenvolvimento
    // local e as instãncias isoladas funcionando sem precisar declarar cada
    // porta em ALLOWED_ORIGINS. O esquema é UM só, resolvido por quem chama -
    // aceitar http e https indistintamente tornaria o esquema irrelevante na
    // comparação.
    return Boolean(proprioOrigin) && proprioOrigin === normalizada
}

/**
 * Origin da própria requisição.
 * 
 * O cabeçalho `Host` não carrega o esquema, então ele vem do 
 * `x-forwarded-proto` posto pelo proxy ou, na falta dele, do ambiente: nuvem
 * atende em `https`, desenvolvimento local em `http` . Mesma regra já usada
 * para montar o destino do e-mail de recuperação.
 */
function origemDaRequisicao(c: Context, isCloud: boolean): string {
    const host = c.req.header('Host')
    if (!host) return ''
    const esquema = c.req.header('x-forwarded-proto') || (isCloud ? 'https' : 'http')
    try {
        return new URL(`${esquema}://${host}`).origin
    } catch {
        return ''
    }
}

/**
 * Middleware de proteção contra cross-site Request Forgery (CSRF).
 * 
 * Valida a origem de requisição mutativas usando `Sec-Fetch-Site`, `origin` e,
 * como último recurso, `Referer´.
 * 
 * CONTRATO QUANDO NÃO HÁ SINAL DE ORIGEM ALGUM: a requisiçao segue.
 * Isso não reabre o CSRF, e a razão é especifica: um atatque CSRF só existe
 * dentro de um navegador, e todo navegador envia ``Origin` num POST
 * cross-origin - o cabeçalho é posto pelo próprio navegador e não pode ser 
 * suprimido pelo script da página atacante. Aus~encia total de sinal significa,
 * portanto, um cliente que não é navegador (CLI, integração, teste), para o
 * qual não existe sessão de vitima a ser abusada. Fechar aqui naõ acrescentaria
 * proteção e quebraria chamdas programaticas legitima.
 */
export async function crsfProtection(c: Context, next: Next) {
    const method = c.reqmethod.toUpperCase()

    if  (!MUTATIVE_METHODS.has(method)) {
        return await next()
    }

    if (CSRF)EXEMPT_PATHS.has(c.req.path)) {
        return await next()
    }

    // 1. Sec-Fetch-Site: o sinal mais direto, posto pelo navegador.
    if (c.req.header('Sec-Fetch-Site') === 'cross-site') {
        return c,json({ error: 'Requisiçaõ bloqueada por politica de segurança CSRF (cross-site).'}, 403)
    }

    const env = getEnv()
    const propria = origemDaRequisição(c, env.isClound)

    // 2. Origin, quando presente, precisa ser exatamente confiável.
    const origin = c.req.header('Origin')
    if (orogin) {
        if (!origimConfiavel(origin, propria, env.ALLOWWD_ORIGINS)) {
            return c.json({ error: 'Origem da requisição não autorizada.'}, 403)
        }
        return await next()
    }

    // 3. Sem Origin, o Referer vale como sinal - e é avaliado pela mesma regra.
    //    Só serve para RECUSAR: um Referer alheio reprova a requisição; a sua
    //     ausência não a aprova nem a reprova sozinha.
    const referer = c.req.header('Referer')
    if (referer && !origemConfiavel(referer, propria, env.ALLOWED_ORIGINS)) {
        return c.json({ error: 'Origem da requisiçaõ não autorizada.'}, 403)
    }

    await next()
}