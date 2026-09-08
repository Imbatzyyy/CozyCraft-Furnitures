import React from 'react';
import {renderToString} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {describe,it,expect} from 'vitest';
import {FullTracking} from './FullTracking';
import type {DbOrder} from '@/services/supabase/client';

describe('tracking incomplete records',()=>{
  for(const relationships of [null,{},[null]]) {
    it(`renders incomplete API data without a route crash: ${JSON.stringify(relationships)}`,()=>{
      const order={id:'test',order_number:'CC-1',status:'pending',payment_status:null,shipping_address:null,order_items:relationships,order_status_history:relationships,payment_transactions:relationships} as unknown as DbOrder;
      expect(()=>renderToString(<MemoryRouter><FullTracking order={order} orders={[order]} onSelect={()=>{}}/></MemoryRouter>)).not.toThrow();
    });
  }
});
