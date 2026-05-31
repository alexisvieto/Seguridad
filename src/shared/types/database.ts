export type MembershipRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type TenantPlan = 'free' | 'pro' | 'enterprise';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type FirearmType = 'revolver' | 'pistola' | 'escopeta';
export type FirearmStatus = 'operativa' | 'mantenimiento' | 'retirada';

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
    };
    CompositeTypes: Record<string, never>;
  };
}
