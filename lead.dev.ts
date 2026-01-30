export type DevLead = {
    id: string;
    orgId: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    addressHash?: string;
    [key: string]: any;
  };
  
  export const leadsByOrg: Record<string, DevLead[]> = {};
  