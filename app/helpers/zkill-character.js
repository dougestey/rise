import { helper } from '@ember/component/helper';

export function zkillCharacter(params/*, hash*/) {
  let character = params[0],
      link = `https://zkillboard.com/character/${character.id}/`;

  return link;
}

export default helper(zkillCharacter);
