/** Fictional profiles for exploring a base persona, not a representative population. */
export type BehaviourDiversity = "low" | "medium" | "high";

const demographics = {
  age: ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
  gender: ["woman", "man", "non-binary", "gender not specified"],
  location: ["urban UK", "rural UK", "urban Sweden", "rural Sweden", "urban Germany", "urban US", "rural US"],
};
const behaviour = {
  shoppingExperience: ["moderate online shopping experience", "experienced online shopper", "less experienced online shopper", "frequent fashion shopper", "occasional fashion shopper"],
  browsingHabit: ["scans before deciding", "reads product details carefully", "compares multiple products", "browses visually", "shops with a specific item in mind"],
  priority: ["balances price and style", "prioritises convenience", "prioritises fit information", "prioritises price", "prioritises visual style"],
  patience: ["moderately patient", "in a hurry", "patient and deliberate", "easily distracted", "focused and methodical"],
};

// Explicit task strategies are illustrative; none prescribe a target or an error.
const attentionStrategies = [
  "looks for the most direct next action",
  "checks fit and sizing information before deciding",
  "looks for price or delivery information before committing",
  "is drawn to prominent high-contrast controls while scanning",
  "looks for a way to save an item for later before deciding",
  "checks product details and materials before deciding",
  "looks for payment or checkout options early",
  "scans navigation and familiar icons when unsure",
  "compares visually similar controls before choosing",
  "is cautious about ambiguous controls and may hesitate",
];

// Independent seeded streams avoid linking demographic attributes to behaviour.
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPilotProfiles(count: number, diversity: BehaviourDiversity): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error("Pilot size must be between 1 and 1000.");
  const draw = random(0x51a7cafe);
  const poolSize = diversity === "low" ? 2 : diversity === "medium" ? 3 : 5;
  const choose = (items: readonly string[]) => items[Math.floor(draw() * items.length)]!;
  const chooseBehaviour = (items: readonly string[]) => choose(items.slice(0, poolSize));
  const profiles = new Set<string>();
  while (profiles.size < count) {
    const strategies = diversity === "low" ? 2 : diversity === "medium" ? 5 : attentionStrategies.length;
    const strategy = attentionStrategies[profiles.size % strategies];
    profiles.add(`Age ${choose(demographics.age)}; ${choose(demographics.gender)}; location ${choose(demographics.location)}; ${chooseBehaviour(behaviour.shoppingExperience)}; ${chooseBehaviour(behaviour.browsingHabit)}; ${chooseBehaviour(behaviour.priority)}; ${chooseBehaviour(behaviour.patience)}; ${strategy}.`);
  }
  return [...profiles];
}
