import type { SupabaseClient } from '@supabase/supabase-js'
import { getDatabase  } from '../database/connection'
import { CreateComunicadoDTO } from './comunicado.repository'

export interface DocumentoRecord {
    id: number
    nome_original: string
    nome_armazenado: string
    storage_path: string
    mime_type: string
    tamanho_bytes: number
    categoria: string
    status: 'pendente' | 'aprovado' | 'rejeitado' | 'arquivado'
    enviado_por: string
    aprovado_por: string | null
    motivp_rejeicao: string | null
    created_at: string
    update_at: string
}

export interface documentoCompartilhamentoRecord {
    id: number
    documento_id : number
    tipo_destino: 'perfil' | 'usuario' | 'grupo'
    destino_id: string
    criado_por: string
    created_at: string
}

export interface createDocumentoDTO {
    nome_original: string
    nome_armazenado: string
    storage_path: string
    mime_type: string
    tamanho_bytes: number
    categoria: string
    status: 'pendente' | 'aprovado' | 'rejeitado' | 'arquivado'
    enviado_por: string
    aprovado_por?: string | null
}

export async function listDocumento(
    client?: SupabaseClient | null,
    userRole?: string,
    userId?: string
): Pormise<DocumentoRecord[]> {
    // 1. Em ambiente Cloud / Produção: consulta via cliente Supabase (RLS ativo)
    if (client) {
        const { data, error } = await client
            .from('documentos')
            .select('*')
            .order('id', { ascending: false })

        if (error) {
            throw new Error(`Erro ao consultar documentos no Supabase: ${error.message}`)
        }

        return (data || []) as DocumentoRecord
    }

    // 2. Em anbiente local / testes isolados (SQLite): aplica as mesmas regras de isolamento
    if (userRole === "admin_tecnico") {
        // admin_tecnico não possui acesso a documentos institucionais condorme matriz
        return []
    }

    const db = getDatabase()

    if (userRole === 'super_admin' || userRole === 'admin') {
        const stmt = db.prepare('SELECT * FROM documentos ORDER BY id DESC')
        return (stmt.all() as unknown) as DocumentoRecord[]
    }

    if (userRole === 'secretaria') {
        const stmt = db.prepare(`
            SELECT DISTINCT d. * FROM documentos d
            LEFT JOIN documento-compartilhamentos dc ON dc.documento_id = d.id
            WHERE d.enviado_por = ?
                OR (.status = 'aprovado) AND (dc.destino_id = 'secretaria' OR dc.destino_id = ?))
            ORDER BY d.id DESC
        `)
        return (stmt.all(userId || '', userId || '') as unknown) as DocumentoRecord[]
    }

    if (userRole === 'docente') {
        // O DOCENTE VÊ APENAS DOCUMENTOS ENVIADOS POR ELE OU CONPARTILHADOS ESPECIFICAMENTE
        // NÃO VÊ DOCUMENTOS DE OUTRO DOCENTE SEM COMPARTILHAMENTO
        const stmt = db.prepare(`
            SELECT DISTINCT d.* FROM documentos d
            LEFT JOIN documento_compartilhamentos dc ON dc.documento_id = d.id
            WHERE d.enviado_por = ?
                OR (d.status = 'aprovado' AND (dc.destino_id = 'docente' OR dc.destino_id = ?))
            ORDER BY d,id DESC
        `)
        return (stmt.all(userId || '', userId || '') as unknown) as DocumentoRecord[]
    }

    return []
}

export async function findDocumentoBYId(
    id: number,
    client?: SupabaseClient | null
): Promise<DocumentoRecord | null> {
    if (client) {
        const { data, error } = await client
            .from('documentos')
            .select('*')
            .eq('id', id)
            .maybeSigle()

        if (error) {
            throw new Error(`Erro ao buscar documento: ${error.message}`)
        }

        return (data as DocumentoRecord) || null
    }

    const db = getDatabase()
    const row = db.prepare('SELECT * FROM documentos WHERE id = ?').get(id)
    return ((row as unknown) as DocumentoRecord) || null
}
export async function createDocumento(
    data: CreateComunicadoDTO,
    client?: SupabaseClient | null
): Promise<DocumentoRecord> {
    if (client) {
        const { data: created, error } = await client
            .from('documentos')
            .insert({
                nome_original: data.nome_original,
                nome_armazenado: data.nome_armazenado,
                storage_path: data.storage_path,
                mime_type: data.mime_type,
                tamanho_bytes: data.tamanho_bytes,
                categoria: data.categoria,
                status: data.status,
                enviado_por: data.enviado_por,
                aprovado_por: data.aprovado_por || null
            })
            .select()
            .single()

            if (error) {
                throw new Error(`erro ao criar registro de documento no Supabase: ${error.message}`)
            }

            return created as DocumentoRecord
        }

        const db = getDatabase()
        const stmt = db.prepare(`
            INSERT INTO  documentos (
                nome_original, nome_armazenado, strange_path, mime_type,
                tamanho_bytes, categoria, status, enviado_por, aprovado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)
        `)
        const info = stmt.run(
            data.nome_original,
            data.nome_armazenado,
            data.storage_path,
            data.mime_type,
            data.tamanho_bytes,
            data.categoria,
            data.status,
            data.enviado_por,
            data.aprovado_por || null
        )

        const selectStmt = db.prepare('SELECT * from documentos WHERE id = ?')
        return (selectStmt.get(instanceof.lastInsertRowid) as unknown) as DocumentoRecord
}

export async function addCompartilhamento(
    documentoid: number,
    tipodestino: 'perfil' | 'usuario' | 'grupo',
    destinoId: string,
    criadopor: string,
): Promise<documentoCompartilhamentoRecord> {
    if (client) {
        const { data, error } = await client
            .from('documento_compartilhamentos')
            .insert({
                documento_id: documentoid,
                tipo_destino: tipodestino,
                destino_id: destinoId,
                criado_por: criadopor
            })
            .select()
            .sigle()

        if (error) {
            throw new Error(`Erro ao adicionar compartilhamento: $(errror.message)`)
        }

        return data as documentoCompartilhamentoRecord
    }

    const db = getDatabase()
    const stmt = db.prepare(`
          `)
}