export type MembershipRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type TenantPlan = 'free' | 'pro' | 'enterprise';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type FirearmType = 'revolver' | 'pistola' | 'escopeta';
export type FirearmStatus = 'operativa' | 'mantenimiento' | 'retirada';
export type InventoryCategory = 'uniforme' | 'calzado' | 'comunicacion' | 'defensa' | 'otros';
export type AssetStatus = 'bueno' | 'dañado' | 'en_reparacion';
export type LoanStatus = 'entregado' | 'devuelto' | 'descontado_por_perdida';

export interface JsonBlock {
  type: string;
  content: unknown;
  children?: JsonBlock[];
}

export interface GpsCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  role: string;
  email?: string;
}

export type Tenant = Database['public']['Tables']['tenants']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Membership = Database['public']['Tables']['memberships']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type PropertyPh = Database['public']['Tables']['properties_ph']['Row'];
export type WorkStation = Database['public']['Tables']['work_stations']['Row'];
export type AgentShift = Database['public']['Tables']['agent_shifts']['Row'];
export type IncidentLog = Database['public']['Tables']['incidents_log']['Row'];
export type FirearmInventory = Database['public']['Tables']['firearms_inventory']['Row'];
export type AgentCompliance = Database['public']['Tables']['agent_compliance']['Row'];
export type FirearmAssignment = Database['public']['Tables']['firearms_assignments']['Row'];
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row'];
export type StationAsset = Database['public']['Tables']['station_asset_custody']['Row'];
export type EquipmentLoan = Database['public']['Tables']['agent_equipment_loans']['Row'];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: TenantPlan;
          settings: Record<string, unknown>;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: TenantPlan;
          settings?: Record<string, unknown>;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: TenantPlan;
          settings?: Record<string, unknown>;
          logo_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: '';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: MembershipRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role?: MembershipRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: MembershipRole;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          tenant_id: string;
          parent_id: string | null;
          title: string;
          content: JsonBlock[];
          icon: string | null;
          cover_url: string | null;
          is_pinned: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          parent_id?: string | null;
          title?: string;
          content?: JsonBlock[];
          icon?: string | null;
          cover_url?: string | null;
          is_pinned?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          content?: JsonBlock[];
          icon?: string | null;
          cover_url?: string | null;
          is_pinned?: boolean;
          parent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'documents';
            referencedColumns: ['id'];
          },
        ];
      };
      properties_ph: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          address: string;
          contact_emergency: EmergencyContact[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          address: string;
          contact_emergency?: EmergencyContact[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          address?: string;
          contact_emergency?: EmergencyContact[];
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'properties_ph_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      work_stations: {
        Row: {
          id: string;
          tenant_id: string;
          property_id: string;
          name: string;
          qr_code_token: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          property_id: string;
          name: string;
          qr_code_token?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          property_id?: string;
          qr_code_token?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'work_stations_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'work_stations_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties_ph';
            referencedColumns: ['id'];
          },
        ];
      };
      agent_shifts: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          work_station_id: string;
          clock_in: string;
          clock_out: string | null;
          clock_in_gps: GpsCoordinates;
          clock_out_gps: GpsCoordinates | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          work_station_id: string;
          clock_in?: string;
          clock_out?: string | null;
          clock_in_gps: GpsCoordinates;
          clock_out_gps?: GpsCoordinates | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          clock_out?: string | null;
          clock_out_gps?: GpsCoordinates | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_shifts_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agent_shifts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agent_shifts_work_station_id_fkey';
            columns: ['work_station_id'];
            isOneToOne: false;
            referencedRelation: 'work_stations';
            referencedColumns: ['id'];
          },
        ];
      };
      incidents_log: {
        Row: {
          id: string;
          tenant_id: string;
          work_station_id: string;
          user_id: string;
          raw_text: string;
          ai_refined_text: string | null;
          status: IncidentStatus;
          am_report_sent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          work_station_id: string;
          user_id: string;
          raw_text: string;
          ai_refined_text?: string | null;
          status?: IncidentStatus;
          am_report_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          raw_text?: string;
          ai_refined_text?: string | null;
          status?: IncidentStatus;
          am_report_sent?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'incidents_log_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'incidents_log_work_station_id_fkey';
            columns: ['work_station_id'];
            isOneToOne: false;
            referencedRelation: 'work_stations';
            referencedColumns: ['id'];
          },
        ];
      };
      firearms_inventory: {
        Row: {
          id: string;
          tenant_id: string;
          serial_number: string;
          type: FirearmType;
          brand: string;
          model: string;
          status: FirearmStatus;
          permit_number: string;
          permit_expiry_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          serial_number: string;
          type: FirearmType;
          brand: string;
          model: string;
          status?: FirearmStatus;
          permit_number: string;
          permit_expiry_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          serial_number?: string;
          type?: FirearmType;
          brand?: string;
          model?: string;
          status?: FirearmStatus;
          permit_number?: string;
          permit_expiry_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'firearms_inventory_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      agent_compliance: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          shooting_test_expiry: string;
          psych_test_expiry: string;
          doping_test_expiry: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          shooting_test_expiry: string;
          psych_test_expiry: string;
          doping_test_expiry: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          shooting_test_expiry?: string;
          psych_test_expiry?: string;
          doping_test_expiry?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_compliance_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      firearms_assignments: {
        Row: {
          id: string;
          tenant_id: string;
          firearm_id: string;
          work_station_id: string | null;
          user_id: string | null;
          assigned_at: string;
          returned_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          firearm_id: string;
          work_station_id?: string | null;
          user_id?: string | null;
          assigned_at?: string;
          returned_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          firearm_id?: string;
          work_station_id?: string | null;
          user_id?: string | null;
          returned_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'firearms_assignments_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'firearms_assignments_firearm_id_fkey';
            columns: ['firearm_id'];
            isOneToOne: false;
            referencedRelation: 'firearms_inventory';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'firearms_assignments_work_station_id_fkey';
            columns: ['work_station_id'];
            isOneToOne: false;
            referencedRelation: 'work_stations';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_items: {
        Row: {
          id: string;
          tenant_id: string;
          item_name: string;
          category: InventoryCategory;
          size_or_model: string | null;
          current_stock: number;
          min_stock_alert: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          item_name: string;
          category: InventoryCategory;
          size_or_model?: string | null;
          current_stock?: number;
          min_stock_alert?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          item_name?: string;
          category?: InventoryCategory;
          size_or_model?: string | null;
          current_stock?: number;
          min_stock_alert?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_items_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      station_asset_custody: {
        Row: {
          id: string;
          tenant_id: string;
          work_station_id: string;
          asset_name: string;
          imei_or_serial: string | null;
          status: AssetStatus;
          last_inspection_at: string;
          damage_report_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          work_station_id: string;
          asset_name: string;
          imei_or_serial?: string | null;
          status?: AssetStatus;
          last_inspection_at?: string;
          damage_report_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          asset_name?: string;
          imei_or_serial?: string | null;
          status?: AssetStatus;
          last_inspection_at?: string;
          damage_report_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'station_asset_custody_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'station_asset_custody_work_station_id_fkey';
            columns: ['work_station_id'];
            isOneToOne: false;
            referencedRelation: 'work_stations';
            referencedColumns: ['id'];
          },
        ];
      };
      agent_equipment_loans: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          item_id: string;
          quantity: number;
          loan_date: string;
          status: LoanStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          item_id: string;
          quantity?: number;
          loan_date?: string;
          status?: LoanStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quantity?: number;
          status?: LoanStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_equipment_loans_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'agent_equipment_loans_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_tenant_ids: {
        Args: Record<string, never>;
        Returns: string[];
      };
      get_user_role_in_tenant: {
        Args: { p_tenant_id: string };
        Returns: MembershipRole;
      };
    };
    Enums: {
      membership_role: MembershipRole;
      tenant_plan: TenantPlan;
      incident_status: IncidentStatus;
      firearm_type: FirearmType;
      firearm_status: FirearmStatus;
      inventory_category: InventoryCategory;
      asset_status: AssetStatus;
      loan_status: LoanStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
