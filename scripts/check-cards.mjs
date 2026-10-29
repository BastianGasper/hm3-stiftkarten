import fs from 'node:fs';
const cards=JSON.parse(fs.readFileSync(new URL('../cards.json',import.meta.url),'utf8'));
if(!Array.isArray(cards)||!cards.length)throw new Error('cards.json muss ein nichtleeres Array sein');
const seen=new Set();
for(const [i,c] of cards.entries()){
 for(const name of ['id','Bereich','Typ','Frage','Antwort','Quelle']){
  if(typeof c[name]!=='string'||!c[name].trim())throw new Error(`Karte ${i+1}: ${name} fehlt`);
 }
 if(!/^[a-zA-Z0-9_-]+$/.test(c.id))throw new Error(`Karte ${i+1}: ungeeignete ID ${c.id}`);
 if(seen.has(c.id))throw new Error(`Doppelte Karten-ID: ${c.id}`);
 seen.add(c.id);
}
console.log(`${cards.length} Karten geprüft: eindeutige IDs, vollständige Felder`);