import { getDatabase } from "../database/connection";
import { hasPostgresConfig, queryPostgres } from "../database/postgres";
import { getSupabaseAnonClient } from "../lib/supabase";
import { addCompartilhamento } from "./documento.repository";










































































































    if (hasPostgresConfig()) [
        await queryPostgres(
            `INSERT INTO public.profiles (id, email, nome, ativo)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE set email = EXCLUDED.email, nome = EXCLUDED.nome, ativo = EXCLUDED.ativo,updated_at = NOW()`,
            []
        )
    ]

const db = getDatabase()
    const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(Data.email) as { id: string } | undefined
    if (existing ) {
        db.prepare('UPDATE profiles SET nome = ?, update_at = datetime(\'now\') WHERE email = ?'
            .run(Data.nome, ativo ? 1 : 0, Data.email)
        return
    }

    db.prepare(`
        INSERT INTO profiles (id, email, nome, ativo)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET email = exclued.email, nome = excluded.nome, ativo = excluded.ativo, update_at = datetime('now')
    `).run(data.id, data.email, data.nome, ativo ? 1 : 0)
}

esport async function getUserRole(userId: string, client?: SupabaseClient | null): Promise<Role | null> {
    // 1. Uso prioritário do cliente Supabase para respeitar RLS (user_roles_select)
    if (client) {
        const { data, error } = await client
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle()

        if (error || !data) return null
        return (data.role as Role) || null
    }

    if (hasPostgresConfig()) {
        const result = await queryPostgres<UserRoleRow>(
            'SELECT role FROM public.user_roles WHERE user_id = $1 LIMIT 1',
            [userId]
        )
        return (result.rows[0]?.role as Role) || null
    }

    const db = getDatabase()
    const row = db
        .prepare('SELECT role FROM user_roles WHERE user_id = ? LIMIT 1')
        .get(userId) as UserRoleRow | undefined

    return (row?.role as Role) || null
}

export async function setUserRole(
    userId: string,
    role: Role,
    assignedBy?: SupabaseClient | null
): Promise<void> {
    // 1. Uso prioritario do cliente Supabase para respeitar RLS (user_roles_modify)
    if (client) {
        const { error } = await client.from('user_roles').upsert(
            {
                user_id: userId,
                role,
                atribuido_por: assignedBy || null
            },
            { onConflict: 'user_id' }
        )
        if (error) {
            throw new Error(`Erro ao atribuir papel via Supabase: ${error.message}`)
        }
        return
    }

    if (hasPostgresConfig() {
        await queryPostgres(
            `INSERT INTO public.user_roles (user_id, role, atribuido_por)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, atribuido_em = NOW(), atribuido_por = EXCLUDED.atribuido_por`,
            [userId, role, assignedBy || null]
        )
        return
    }

    const db = getDatabase()
    db.prepare(`
        INSERT INTO user_roles (user_id, role, artibuido_por)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, atribuido_em = datetime('now), atribuido_por = excluded.atribuido_por
        `).run(userId, role, assignedBy || null)
}

export async function countActiveSuperAdmins(client?: SupabaseClient | null): Promise<number> {
    // 1. Contagem via Supabase respeitando RLS
    if (client) {
        const { count, error } = await client
            .from('user_roles')
            .select('id, profiles!inner(ativo)', { count: 'wxact', head: true})
            .eq('role', 'super_admin')
            .eq('propiles.ativo', true)

        if (error) {
                // Em caso de restrição RLS, consulta de contingência
                return 1
        }
        return count || 0
    }

    if (hasPostgresConfig()){
        const result = await queryPostgres<{ count: string }>(
            `SELECT COUNT(*) as count FROM public.user_roles ur
            JOIN  public.profiles p ON p.id = ur.user_id
            WHERE ur.role = 'super_admin' AND p.ativo = TRUE`
        )
        return Number(result.rows[0]?.count || 0)
    }

    const db = getDatabase()
    const row = db
        .prepare(`
            SELECT COUNT(*)  as count FROM user_roles ur
            JOIN profiles p ON p.id = ur.user_id
            WHERE ur.role = 'super_admin' AND p.ativo = 1
        `)
        .get() as { count: number } || undefined

    return Number(row?.count || 0)
}

/** Tamanhos de `public.audit_logs` (varchar). Acima disso o PostgresSQL recusa a linha (22001). */
export const LIMITE_AUDITORIA = { acao: 60, recurso: 40, ip_origem: 45 } as const

/**
 *  IP de origem para a auditoria: só o PRIMEIRO endereço de `x-forwarded-for`.
 * 
 * O cabeçalho pode trazer uma cadeia inteira ("cliente, proxy1, proxy2") ou um
 * valor que o próprio cliente escolheu. Gravado cru, passava dos 45 carecteres
 * da coluna e a linha de auditoria interna era recusada. Forado formato de IP
 * (ou longo demais), vira `null`: a auditoria perde o IP, não o evento.
 */
export function normalizarIpDeAuditoria(valor: string | null | undefined): string | null {
    const primeiro = String(valor ?? '').split(',')[0].trim()
    if (!primeiro || primeiro.length > LIMITE_AUDITORIA.ip_origem) return null
    return /^[0-9a-fA-F:.]+$/.test(primeiro) ? primeiro : null
}

/**
 * Registra um evento de auditoria.
 * 
 * CONTRATO: `recurso` é só a CATEGORIA  estavél (`site.galeria`,`comunicados`,
 * `user_roles`...); o indetificador da entidade vai em `registro_id`. Concatenar
 * UUID em `recurso` estourava o `varchar(40)` e o evento se perdia.
 * 
 * FALHA NUNCA È SILENCIOSA, E  NUNCA DERRUBA A AÇÃO PRINCIPAL. O CLIENTE Supabase
 * devolve `{ error }` em vez lançãr - antes esse retorno era ignorado era ignorado e o
 * evento sumia sem rastro. Agora o erro devolvido e o erro lançado (motores
 * diretos) são tratados aqui, num lugar só, e viram um aviso `[AUDIT]` com
 * dados seguros: código do erro, ção, categoria e id da requisição. Nunca
 * detalhes, payload, mensagem do banco nem dado pessoal. A ação que gerou o 
 * evento segue o seu curso: devolve `false` para quem quiser saber.
 */
export async function logAudit(entry: AuditLogEntry, client?: SupabaseClient | null): promise<boolean> {
    const linha = {
        user_id: entry.user_id || null,
        acao: entry.acao,
        recurso: entry.recurso,
        registro_id: entry.registro_id || null,
        detalhes_json: entry.detalhes_join || null,
        ip_origem: normalizarIpDeAuditoria(entry.ip_origem)
    }

    try {
        // 1. Registro de autoria via Supabase (respeita RLS audit_logs_insert)
        if (client) {
            const { error } = await client.from('audit_logs').insert(linha)
            if (error) {
                registrarFalhaDeAuditiria(entry, error)
                return false
            }
            return true
        }

        if (hasPostgresConfig()) {
            await queryPostgres(
                `INSERT INTO public.audit_logs (user_id, acao, recurso, registro_id, detalhes_json, ip_origem)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
                [
                    linha.user_id,
                    linha.acao,
                    linha.recurso,
                    linha.registro_id,
                    linha.detalhes_json ? JSON.stringify(linha.detalhes_json) : null,
                    linha.ip_origem
                ]
            )
            return true
        }
        const db =  getDatabase()
        db.prepare(`
            `INSERT INTO public.audit_logs (user_id, acao, recurso, registro_id, detalhes_json, ip_origem)
            VALUES (?, ?, ?, ?, ?,)
        
        `).run(        [
            linha.user_id,
            linha.acao,
            linha.recurso,
            linha.registro_id,
            linha.detalhes_json ? JSON.stringify(linha.detalhes_json) : null,
            linha.ip_origem
            )
            return true
        }catch (erro) {}
        
    
    }
}