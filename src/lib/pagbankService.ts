/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Serviço de integração com API PagBank para pagamentos Pix
 */

export interface PagBankOrderResponse {
  success: boolean;
  order_id: string;
  transaction_id?: string;
  reference_id: string;
  status: 'WAITING' | 'PAID' | 'CANCELED' | 'EXPIRED';
  qr_code: {
    qr_code_text: string;
    qr_code_image: string;
  };
  expires_at: string;
  amount: {
    value: number;
    currency: string;
  };
  payment_method: {
    type: string;
    qr_code?: {
      text: string;
      image: {
        content: string;
        content_type: string;
      };
    };
  };
}

export interface PagBankWebhookPayload {
  id: string;
  reference_id?: string;
  status: string;
  charges?: Array<{
    status: string;
  }>;
}

export interface CreatePixOrderParams {
  amount: number;
  userId: string;
  userEmail: string;
  userName: string;
  groupId: string;
  groupName: string;
  userCpf?: string;
  userPhone?: string;
  description?: string;
}

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pagbank-create-order`
  : null;

// Nova URL para a Edge Function do n8n
const EDGE_FUNCTION_N8N_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/n8n-create-order`
  : null;

const EDGE_FUNCTION_WEBHOOK_TEST = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pagbank-webhook-test`
  : null;

export class PagBankService {
  static async createPixOrder(params: CreatePixOrderParams): Promise<{
    success: boolean;
    data?: PagBankOrderResponse;
    error?: string;
  }> {
    // Alterne USE_N8N para 'false' quando a Whitelist do PagBank for liberada.
    const USE_N8N = true; 
    const endpoint = USE_N8N ? EDGE_FUNCTION_N8N_URL : EDGE_FUNCTION_URL;

    if (!endpoint) {
      return { success: false, error: 'Edge Function URL não configurada' };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
        },
        body: JSON.stringify({
          amount: params.amount,
          userId: params.userId,
          userEmail: params.userEmail,
          userName: params.userName,
          groupId: params.groupId,
          groupName: params.groupName,
          userCpf: params.userCpf,
          userPhone: params.userPhone,
          description: params.description || `Taxa de inscrição - ${params.groupName}`
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const debugParts = [
          errorData.error,
          errorData.message,
          errorData.code ? `code=${errorData.code}` : null,
          `status=${response.status}`,
          `groupId=${params.groupId || 'null'}`,
          `groupName=${params.groupName || 'null'}`,
          `amount=${params.amount ?? 'null'}`
        ].filter(Boolean);
        throw new Error(debugParts.join(' | ') || `Erro HTTP: ${response.status}`);
      }

      const data: PagBankOrderResponse = await response.json();
      
      return { success: true, data };
    } catch (err: any) {
      console.error('PagBank createPixOrder error:', err);
      return { success: false, error: err.message || 'Erro ao criar ordem PagBank' };
    }
  }

  static async checkOrderStatus(orderId: string): Promise<{
    success: boolean;
    status?: 'WAITING' | 'PAID' | 'CANCELED' | 'EXPIRED';
    error?: string;
  }> {
    if (!EDGE_FUNCTION_URL) {
      return { success: false, error: 'Edge Function URL não configurada' };
    }

    try {
      const response = await fetch(`${EDGE_FUNCTION_URL}?orderId=${orderId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
        }
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

      const data = await response.json();
      return { success: true, status: data.status };
    } catch (err: any) {
      console.error('PagBank checkOrderStatus error:', err);
      return { success: false, error: err.message };
    }
  }

  static async testWebhookSimulation(orderId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!EDGE_FUNCTION_WEBHOOK_TEST) {
      return { success: false, error: 'Edge Function de teste não configurada' };
    }

    try {
      const response = await fetch(EDGE_FUNCTION_WEBHOOK_TEST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
        },
        body: JSON.stringify({ orderId })
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      return { success: true };
    } catch (err: any) {
      console.error('PagBank testWebhookSimulation error:', err);
      return { success: false, error: err.message };
    }
  }

  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
  }

  static parseAmount(amountBRL: number): number {
    return Math.round(amountBRL * 100);
  }

  static getExpirationText(expiresAt: string): string {
    const expiresDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiresDate.getTime() - now.getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
    const diffSecs = Math.max(0, Math.floor((diffMs % 60000) / 1000));
    return `${diffMins}:${diffSecs.toString().padStart(2, '0')}`;
  }

  static isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  static getStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      'WAITING': 'Aguardando pagamento',
      'PAID': 'Pago',
      'CANCELED': 'Cancelado',
      'EXPIRED': 'Expirado',
      'IN_ANALYSIS': 'Em análise',
      'DECLINED': 'Recusado'
    };
    return statusMap[status] || status;
  }

  static getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'WAITING': 'text-amber-400',
      'PAID': 'text-green-400',
      'CANCELED': 'text-red-400',
      'EXPIRED': 'text-gray-400',
      'IN_ANALYSIS': 'text-blue-400',
      'DECLINED': 'text-red-400'
    };
    return colorMap[status] || 'text-gray-400';
  }
}
