import { queryVoalle } from '../../database/voalle.client.js';

/**
 * Protocolos de "Gestão de Acessos" no Voalle — a consulta do time, enxuta:
 *   - sem o JOIN em `reports` (só servia para desempatar linhas duplicadas;
 *     aqui o DISTINCT ON por protocolo faz isso);
 *   - protocolos vinculados agregados numa lista, em vez de multiplicar linhas;
 *   - imagens coladas na descrição removidas já no banco (são base64 de MBs).
 * Os cálculos de dias/atraso ficam no serviço, com a mesma regra da consulta.
 */
export interface VoalleProtocolRow {
  assignment_id: number;
  protocol_number: string;
  title: string | null;
  status: string | null;
  requester_name: string | null;
  requester_email: string | null;
  created_at: string | null;
  deadline: string | null;
  closed_at: string | null;
  delivery_deadline: string | null;
  responsible_name: string | null;
  gravity: number | null;
  tendency: number | null;
  urgency: number | null;
  team: string | null;
  category_2: string | null;
  category_3: string | null;
  category_4: string | null;
  category_5: string | null;
  solution: string | null;
  description: string | null;
  linked_protocols: string | null;
}

const PROTOCOLS_SQL = `
WITH base AS (
  SELECT DISTINCT ON (ai.protocol)
    a.id AS assignment_id,
    ai.protocol::text AS protocol_number,
    a.title,
    ist.title AS status,
    p.name AS requester_name,
    p.email AS requester_email,
    a.created::text AS created_at,
    a.final_date::text AS deadline,
    a.conclusion_date::text AS closed_at,
    ai.responsible_final_date::text AS delivery_deadline,
    p2.name AS responsible_name,
    a.gravity,
    a.tendency,
    a.urgency,
    t.title AS team,
    REPLACE(ssc2.title, 'Requisições', 'Requisição') AS category_2,
    ssc3.title AS category_3,
    ssc4.title AS category_4,
    ssc5.title AS category_5,
    ss.title AS solution,
    LEFT(REGEXP_REPLACE(a.description, '<img[^>]*>', '<p>[imagem]</p>', 'gi'), 8000) AS description
  FROM assignments a
  JOIN assignment_incidents ai ON ai.assignment_id = a.id
  LEFT JOIN incident_status ist ON ist.id = ai.incident_status_id
  LEFT JOIN people p ON p.id = ai.person_id
  LEFT JOIN people p2 ON p2.id = a.responsible_id
  LEFT JOIN teams t ON t.id = ai.team_id
  LEFT JOIN solicitation_category_matrices scm ON scm.id = ai.solicitation_category_matrix_id
  LEFT JOIN solicitation_service_categories ssc1 ON ssc1.id = scm.service_category_id_1
  LEFT JOIN solicitation_service_categories ssc2 ON ssc2.id = scm.service_category_id_2
  LEFT JOIN solicitation_service_categories ssc3 ON ssc3.id = scm.service_category_id_3
  LEFT JOIN solicitation_service_categories ssc4 ON ssc4.id = scm.service_category_id_4
  LEFT JOIN solicitation_service_categories ssc5 ON ssc5.id = scm.service_category_id_5
  LEFT JOIN solicitation_solutions ss ON ss.id = ai.solicitation_solution_id
  WHERE ssc1.title = $1
    AND a.created >= $2::date
  ORDER BY ai.protocol, a.id DESC
)
SELECT
  b.*,
  (
    SELECT STRING_AGG(DISTINCT ai2.protocol::text, ', ')
    FROM assignment_links al
    JOIN assignment_incidents ai2 ON ai2.assignment_id = al.assignment_id
    WHERE al.assignment_linked_id = b.assignment_id
  ) AS linked_protocols
FROM base b
ORDER BY b.created_at DESC
`;

export function fetchAccessProtocols(category: string, since: string): Promise<VoalleProtocolRow[]> {
  return queryVoalle<VoalleProtocolRow>(PROTOCOLS_SQL, [category, since]);
}
