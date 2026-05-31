export type {
  InventoryItem,
  StationAsset,
  EquipmentLoan,
  InventoryCategory,
  AssetStatus,
  LoanStatus,
} from '@/shared/types/database';

export interface CreateInventoryItemInput {
  tenant_id: string;
  item_name: string;
  category: 'uniforme' | 'calzado' | 'comunicacion' | 'defensa' | 'otros';
  size_or_model?: string;
  current_stock?: number;
  min_stock_alert?: number;
}

export interface CreateStationAssetInput {
  tenant_id: string;
  work_station_id: string;
  asset_name: string;
  imei_or_serial?: string;
}

export interface CreateLoanInput {
  tenant_id: string;
  user_id: string;
  item_id: string;
  quantity: number;
}

export interface StockAlert {
  itemId: string;
  itemName: string;
  category: string;
  currentStock: number;
  minAlert: number;
  deficit: number;
}
