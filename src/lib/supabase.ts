import { getLocalData, setLocalData, initStorage } from './storage';
import { generateSecureId } from './utils';

initStorage();

export const supabase = {
  from(tableName: string) {
    return new QueryBuilder(tableName);
  }
};

type Filter =
  | { type: 'eq'; col: string; val: unknown }
  | { type: 'in'; col: string; vals: unknown[] }
  | { type: 'ilike'; col: string; val: string };

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

class QueryBuilder {
  private filters: Filter[] = [];
  private orderCol?: string;
  private orderAsc = true;
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: Row | Row[] = {};
  private isSingle = false;

  constructor(private table: string) {}

  select(cols?: string) {
    void cols;
    if (this.action !== 'insert' && this.action !== 'update' && this.action !== 'upsert') {
      this.action = 'select'; 
    }
    return this; 
  }
  insert(data: Row | Row[]) { this.action = 'insert'; this.payload = data; return this; }
  update(data: Row) { this.action = 'update'; this.payload = data; return this; }
  upsert(data: Row | Row[]) { this.action = 'upsert'; this.payload = data; return this; }
  delete() { this.action = 'delete'; return this; }

  eq(col: string, val: unknown) { this.filters.push({ type: 'eq', col, val }); return this; }
  in(col: string, vals: unknown[]) { this.filters.push({ type: 'in', col, vals }); return this; }
  ilike(col: string, val: string) { this.filters.push({ type: 'ilike', col, val }); return this; }
  
  order(col: string, opts = { ascending: true }) { this.orderCol = col; this.orderAsc = opts.ascending; return this; }
  maybeSingle() { this.isSingle = true; return this; }
  single() { this.isSingle = true; return this; }

  async execute(): Promise<{ data: Row | Row[] | null; error: { message: string } | null }> {
    let allData = getLocalData<Row[]>(this.table, []);
    
    if (this.action === 'select') {
      const result = allData.filter(item => this.matchFilters(item));
      if (this.orderCol) {
        result.sort((a, b) => {
          const valA = a[this.orderCol!];
          const valB = b[this.orderCol!];
          if (valA < valB) return this.orderAsc ? -1 : 1;
          if (valA > valB) return this.orderAsc ? 1 : -1;
          return 0;
        });
      }
      if (this.isSingle) return { data: result.length > 0 ? result[0] : null, error: null };
      return { data: result, error: null };
    }

    if (this.action === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const itemsWithIds = items.map(item => ({
        ...item,
        id: item.id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : generateSecureId()),
        created_at: item.created_at || new Date().toISOString()
      }));
      allData = [...allData, ...itemsWithIds];
      setLocalData(this.table, allData);
      if (this.isSingle) return { data: itemsWithIds[0], error: null };
      return { data: itemsWithIds, error: null };
    }

    if (this.action === 'update') {
      allData = allData.map(item => {
        if (this.matchFilters(item)) {
          return { ...item, ...this.payload };
        }
        return item;
      });
      setLocalData(this.table, allData);
      return { data: null, error: null };
    }

    if (this.action === 'upsert') {
       const items = Array.isArray(this.payload) ? this.payload : [this.payload];
       for (const item of items) {
           const idx = allData.findIndex(x => x.id === item.id);
           if (idx >= 0) allData[idx] = { ...allData[idx], ...item };
           else allData.push({ ...item, id: item.id || (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : generateSecureId()), created_at: item.created_at || new Date().toISOString() });
       }
       setLocalData(this.table, allData);
       return { data: null, error: null };
    }

    if (this.action === 'delete') {
      allData = allData.filter(item => !this.matchFilters(item));
      setLocalData(this.table, allData);
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  private matchFilters(item: Row): boolean {
    for (const f of this.filters) {
      if (f.type === 'eq' && item[f.col] !== f.val) return false;
      if (f.type === 'in' && !f.vals.includes(item[f.col])) return false;
      if (f.type === 'ilike') {
        const itemVal = String(item[f.col]).toLowerCase();
        const searchVal = String(f.val).toLowerCase().replace(/%/g, '');
        if (!itemVal.includes(searchVal)) return false;
      }
    }
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then<TResult1 = any, TResult2 = never>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
