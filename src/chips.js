(function(root) {
  'use strict';
  const denominations = [500,100,25,5,1];
  function split(amount, change = false) {
    if (!Number.isSafeInteger(amount) || amount < 0) throw Error('筹码金额必须是非负整数');
    let remaining=amount;
    return denominations.map(value=>{
      let count=Math.floor(remaining/value);
      // Keep small change in each player's bank, without inventing any value.
      if(change && value>1 && count>0) count--;
      remaining-=count*value;
      return {value,count};
    }).filter(group=>group.count>0);
  }
  function move(amount, player, options) {
    if(!options) throw Error('请等轮到你时再投放筹码');
    if(!Number.isSafeInteger(amount)||amount<=0||amount>player.stack) throw Error('请选择有效的筹码金额');
    if(amount===options.call) return ['call'];
    const total=player.bet+amount;
    if(!options.canRaise) throw Error(`本次只能跟注 ${options.call} 筹码`);
    if(total<=player.bet+options.call) throw Error(`跟注需要 ${options.call} 筹码`);
    if(total<options.min && total!==options.max) throw Error(`加注至少需要再投入 ${options.min-player.bet} 筹码，或全下`);
    return ['raise',total];
  }
  const api={denominations,split,move};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.TableChips=api;
})(typeof globalThis!=='undefined'?globalThis:this);
