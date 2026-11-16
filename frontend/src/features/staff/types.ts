export interface StaffUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  must_change_password?: boolean;
  last_login?: string | null;
  created_at: string;
}

export interface StaffOrganization {
  id: string;
  name: string;
  subdomain: string;
}

export interface StaffStore {
  id: string;
  name: string;
  address?: string | null;
}

export interface StaffMember {
  id: string;
  type: 'store' | 'organization';
  user: StaffUser;
  organization: StaffOrganization | null;
  store: StaffStore | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffListParams {
  store_id?: string;
  role?: string;
  is_active?: boolean | string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StaffOnboardPayload {
  email: string;
  first_name: string;
  last_name?: string;
  password?: string;
  scope: 'store' | 'organization';
  store_id?: string | null;
  role: string;
  reassign_if_exists?: boolean;
  reactivate_if_deactivated?: boolean;
}

export interface StaffUpdatePayload {
  role?: string;
  store_id?: string;
  is_active?: boolean;
}

export interface CheckEmailResponse {
  exists: boolean;
  status: 'new' | 'same_org' | 'other_org' | 'deactivated';
  message: string;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  current_scope?: 'store' | 'organization';
  current_store_id?: string | null;
  current_store_name?: string | null;
  current_role?: string;
}
