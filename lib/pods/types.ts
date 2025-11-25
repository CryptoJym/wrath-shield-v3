export type PodInput = {
  userId: string;
  events: any[];
  memorySearch: (query: string, limit?: number) => Promise<any[]>;
  now?: Date;
};

export type PodOutput = {
  actions: any[];
  notes?: string[];
  confidence?: number;
};
