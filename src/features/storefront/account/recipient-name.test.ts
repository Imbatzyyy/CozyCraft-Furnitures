import {describe,it,expect} from 'vitest';
import {joinRecipientName,splitRecipientName} from './recipient-name';
describe('delivery recipient names',()=>{
  it('joins both fields for the existing database and checkout',()=>expect(joinRecipientName(' Ana Maria ',' de la Cruz ')).toBe('Ana Maria de la Cruz'));
  it('preserves every word of legacy full names',()=>{for(const name of ['Kian Sanchez','Ana Maria de la Cruz',"Jean-Luc O’Connor"]){const parts=splitRecipientName(name);expect(joinRecipientName(parts.first,parts.last)).toBe(name);}});
  it('does not invent a surname for a single name',()=>expect(splitRecipientName('Prince')).toEqual({first:'Prince',last:''}));
  it('handles an empty recipient',()=>expect(splitRecipientName('')).toEqual({first:'',last:''}));
});
