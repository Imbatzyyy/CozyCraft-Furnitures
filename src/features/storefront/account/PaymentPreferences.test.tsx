import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {PaymentPreferences} from './PaymentPreferences';
describe('payment preferences',()=>{
  it('renders three real radio options and the saved default',()=>{const html=renderToStaticMarkup(<PaymentPreferences value="gcash" save={async()=>null} enabled={{cod:true,card:true,gcash:true}}/>);expect(html.match(/type="radio"/g)).toHaveLength(3);expect(html).toContain('value="gcash"');expect(html).toContain('Saved default');expect(html).toContain('Set default payment');});
  it('marks unavailable methods and does not save during render',()=>{let writes=0;const html=renderToStaticMarkup(<PaymentPreferences value="cod" save={async()=>{writes++;return null;}} enabled={{cod:true,card:false,gcash:false}}/>);expect(html.match(/Currently unavailable/g)).toHaveLength(2);expect(writes).toBe(0);});
});
