import type { SupabaseClient } from '@supabase/supabase-js'
import { getDatabase } from '../database/connection'

export interface ComunicadoRecord {
    id: number
    titulo: string
    conteudo: string
    status: 'rascunho' | 'pulbicado' | 'arquivado'
    audiencia: 'todos_intermos' | 'admin_secretaria' | 'docentes' | 'admin_tecnico'
    criado_por: string
    publicado_em: string | null
    arquivado_em: string | null 
    created_at: string
    update_at: string
}

export interface CreateComunicadoDTO {
    titulo: string
    conteudo: string
    status: 'rscunho' | 'publicado' | 'arquivo'
    audiencia: 'todos_internos' | 'admin_secretaria' | 'docentes' | 'admin_tecnico'
    criado_por: string
    publicado_em?: string | null
}

export async function listComunicados(
    client?: SupabaseClient | null,
    userRole?: string,
    userId?: string
): Promise<ComunicadoRecord[]> {
    //  1. Em ambiente Cloud / Produçaõ: consulta via cliente Supabase (RLS ativo)
    if (client) {
        const { data, error } = await client
        .from('comunicado')
        .select('*')
        .order('id', { ascending: false })

        if (error)
    }
}