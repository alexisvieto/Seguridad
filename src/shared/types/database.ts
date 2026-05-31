export type MembershipRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type TenantPlan = 'free' | 'pro' | 'enterprise';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type FirearmType = 'revolver' | 'pistola' | 'escopeta';
export type FirearmStatus = 'operativa' | 'mantenimiento' | 'retirada';
export type InventoryCategory = 'uniforme' | 'calzado' | 'comunicacion' | 'defensa' | 'otros';
export type AssetStatus = 'bueno' | 'dañado' | 'en_reparacion';
export type LoanStatus = 'entregado' | 'devuelto' | 'descontado_por_perdida';
export type VehicleType = 'auto' | 'moto' | 'scooter' | 'bicicleta';
export type VehicleStatus = 'activo' | 'taller' | 'siniestrado';
export type ViolationType = 'salida_de_zona' | 'exceso_velocidad' | 'parada_prolongada_no_autorizada';
export type ViolationStatus = 'pendiente' | 'justificado' | 'notificado';
export type ContractType = 'definido' | 'indefinido';
export type ContractStatus = 'pendiente_sello' | 'activo' | 'vencido' | 'terminado';
export type DisciplinaryType = 'llamado_atencion' | 'falta' | 'suspension';
export type AgentRequestType = 'nuevo_uniforme' | 'vacaciones' | 'carta_trabajo' | 'permiso_remunerado';
export type AgentRequestStatus = 'pendiente' | 'aprobado' | 'rechazado';
export type VaultDocumentType = 'ficha_css' | 'record_policial' | 'prueba_antidopaje' | 'evaluacion_psicologica' | 'certificacion_diasp' | 'paz_y_salvo_equipos';

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
export type FleetVehicle = Database['public']['Tables']['fleet_vehicles']['Row'];
export type VehicleGpsLog = Database['public']['Tables']['vehicle_gps_logs']['Row'];
export type GeofenceViolation = Database['public']['Tables']['geofence_violations']['Row'];
export type HrAgentProfile = Database['public']['Tables']['hr_agent_profiles']['Row'];
export type HrContract = Database['public']['Tables']['hr_contracts']['Row'];
export type HrDisciplinaryRecord = Database['public']['Tables']['hr_disciplinary_records']['Row'];
export type HrAgentRequest = Database['public']['Tables']['hr_agent_requests']['Row'];
export type HrEmployeeVault = Database['public']['Tables']['hr_employee_vault']['Row'];

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
      fleet_vehicles: {
        Row: {
          id: string;
          tenant_id: string;
          plate_number: string;
          vehicle_type: VehicleType;
          brand_model: string;
          gps_device_id: string | null;
          current_odometer: number;
          next_maintenance_odometer: number;
          status: VehicleStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plate_number: string;
          vehicle_type: VehicleType;
          brand_model: string;
          gps_device_id?: string | null;
          current_odometer?: number;
          next_maintenance_odometer: number;
          status?: VehicleStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plate_number?: string;
          vehicle_type?: VehicleType;
          brand_model?: string;
          gps_device_id?: string | null;
          current_odometer?: number;
          next_maintenance_odometer?: number;
          status?: VehicleStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fleet_vehicles_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      vehicle_gps_logs: {
        Row: {
          id: number;
          tenant_id: string;
          vehicle_id: string;
          latitude: number;
          longitude: number;
          speed_kmh: number;
          odometer_reading: number | null;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          tenant_id: string;
          vehicle_id: string;
          latitude: number;
          longitude: number;
          speed_kmh?: number;
          odometer_reading?: number | null;
          recorded_at: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'vehicle_gps_logs_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vehicle_gps_logs_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'fleet_vehicles';
            referencedColumns: ['id'];
          },
        ];
      };
      geofence_violations: {
        Row: {
          id: string;
          tenant_id: string;
          vehicle_id: string;
          property_id: string | null;
          violation_type: ViolationType;
          description: string;
          status: ViolationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          vehicle_id: string;
          property_id?: string | null;
          violation_type: ViolationType;
          description: string;
          status?: ViolationStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          description?: string;
          status?: ViolationStatus;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'geofence_violations_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'geofence_violations_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'fleet_vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'geofence_violations_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'properties_ph';
            referencedColumns: ['id'];
          },
        ];
      };
      hr_agent_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          css_number: string | null;
          life_insurance_policy: string | null;
          security_carnet_number: string | null;
          carnet_expiry_date: string | null;
          hire_date: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          css_number?: string | null;
          life_insurance_policy?: string | null;
          security_carnet_number?: string | null;
          carnet_expiry_date?: string | null;
          hire_date?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          css_number?: string | null;
          life_insurance_policy?: string | null;
          security_carnet_number?: string | null;
          carnet_expiry_date?: string | null;
          hire_date?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hr_agent_profiles_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      hr_contracts: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          contract_type: ContractType;
          start_date: string;
          end_date: string | null;
          base_salary: number;
          status: ContractStatus;
          termination_reason: string | null;
          mitradel_sealed_pdf_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          contract_type: ContractType;
          start_date: string;
          end_date?: string | null;
          base_salary: number;
          status?: ContractStatus;
          termination_reason?: string | null;
          mitradel_sealed_pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          contract_type?: ContractType;
          start_date?: string;
          end_date?: string | null;
          base_salary?: number;
          status?: ContractStatus;
          termination_reason?: string | null;
          mitradel_sealed_pdf_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hr_contracts_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      hr_disciplinary_records: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          record_type: DisciplinaryType;
          description: string;
          start_date: string;
          end_date: string | null;
          registered_by: string | null;
          signed_ammendment_pdf_url: string | null;
          photographic_evidence_urls: string[];
          legal_validity_flag: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          record_type: DisciplinaryType;
          description: string;
          start_date: string;
          end_date?: string | null;
          registered_by?: string | null;
          signed_ammendment_pdf_url?: string | null;
          photographic_evidence_urls?: string[];
          legal_validity_flag?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          record_type?: DisciplinaryType;
          description?: string;
          start_date?: string;
          end_date?: string | null;
          signed_ammendment_pdf_url?: string | null;
          photographic_evidence_urls?: string[];
          legal_validity_flag?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hr_disciplinary_records_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      hr_agent_requests: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          request_type: AgentRequestType;
          details: string;
          status: AgentRequestStatus;
          reviewed_by: string | null;
          review_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          request_type: AgentRequestType;
          details: string;
          status?: AgentRequestStatus;
          reviewed_by?: string | null;
          review_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: AgentRequestStatus;
          reviewed_by?: string | null;
          review_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hr_agent_requests_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      hr_employee_vault: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          document_type: VaultDocumentType;
          document_url: string;
          expiration_date: string | null;
          uploaded_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          document_type: VaultDocumentType;
          document_url: string;
          expiration_date?: string | null;
          uploaded_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          document_type?: VaultDocumentType;
          document_url?: string;
          expiration_date?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'hr_employee_vault_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
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
      decrement_stock: {
        Args: { p_item_id: string; p_quantity: number };
        Returns: number;
      };
      increment_stock: {
        Args: { p_item_id: string; p_quantity: number };
        Returns: number;
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
      vehicle_type: VehicleType;
      vehicle_status: VehicleStatus;
      violation_type: ViolationType;
      violation_status: ViolationStatus;
      contract_type: ContractType;
      contract_status: ContractStatus;
      disciplinary_type: DisciplinaryType;
      agent_request_type: AgentRequestType;
      agent_request_status: AgentRequestStatus;
      vault_document_type: VaultDocumentType;
    };
    CompositeTypes: Record<string, never>;
  };
}
