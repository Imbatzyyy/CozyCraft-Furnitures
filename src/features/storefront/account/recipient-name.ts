export const joinRecipientName=(first:string,last:string)=>[first.trim(),last.trim()].filter(Boolean).join(' ').replace(/\s+/g,' ');
// Legacy addresses have one full-name field. Preserve all words; the split is
// editable because compound given names and surnames cannot be inferred.
export function splitRecipientName(name:string){const words=name.trim().split(/\s+/).filter(Boolean);return{first:words.slice(0,-1).join(' ')||words[0]||'',last:words.length>1?words.at(-1)!:''};}
