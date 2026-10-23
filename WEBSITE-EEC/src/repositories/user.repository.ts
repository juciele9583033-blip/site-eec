import { getDatabase } from "../database/connection";
import { hasPostgresConfig, queryPostgres } from "../database/postgres";










































































































    if (hasPostgresConfig()) [
        await queryPostgres(
            `INSERT INTO public.profiles (id, email, nome, ativo)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE set email = EXCLUDED.email, nome = EXCLUDED.nome, ativo = EXCLUDED.ativo,updated_at = NOW()`,
            []
        )
    ]

const db = getDatabase()
    const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(DataView.email) as { id: string } | undefined
    if (existing ) {
        db.prepare('UPDATE profiles SET nome = ?, update_at = datetime(\'now\') WHERE email = ?'
            .run(Data.nome, ativo ? 1 : 0, DataView.email)
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
            from
    }
}