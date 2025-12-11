/**
 * HYRO Forge: Real Question Generator
 *
 * Generates legitimate, solvable assessment questions across all domains
 * following the 4-Tier architecture (Foundation, Bridge, Power, Horizon)
 *
 * @hyro-domain assessment_content
 * @hyro-manifold Quality content generation for diagnostic system
 */

import { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';

const db = new Database('data/wrath-shield.db');

interface QuestionItem {
  id: string;
  stat_name: string;
  topic: string;
  prompt: string;
  options: string; // JSON
  correct: string;
  difficulty: number;
}

// =============================================================================
// SCIENCE QUESTIONS
// =============================================================================

function generateScienceQuestions(): QuestionItem[] {
  const items: QuestionItem[] = [];

  // TIER 1: Foundation - Physical Sciences (Newtonian)
  const physicsFoundation = [
    {
      prompt: "What is the SI unit of force?",
      options: { a: "Newton", b: "Joule", c: "Watt", d: "Pascal" },
      correct: "Newton"
    },
    {
      prompt: "According to Newton's First Law, an object at rest will:",
      options: {
        a: "Stay at rest unless acted upon by an external force",
        b: "Eventually start moving",
        c: "Always accelerate downward",
        d: "Vibrate in place"
      },
      correct: "Stay at rest unless acted upon by an external force"
    },
    {
      prompt: "What is the formula for calculating speed?",
      options: {
        a: "Distance ÷ Time",
        b: "Time × Mass",
        c: "Force × Distance",
        d: "Mass × Acceleration"
      },
      correct: "Distance ÷ Time"
    },
    {
      prompt: "A ball is thrown upward. At its highest point, its velocity is:",
      options: { a: "Zero", b: "Maximum", c: "Negative", d: "Equal to initial velocity" },
      correct: "Zero"
    },
    {
      prompt: "What type of energy does a moving car have?",
      options: { a: "Kinetic energy", b: "Potential energy", c: "Chemical energy", d: "Nuclear energy" },
      correct: "Kinetic energy"
    },
  ];

  for (const q of physicsFoundation) {
    items.push({
      id: `sci_found_phys_${uuidv4().slice(0, 8)}`,
      stat_name: 'science',
      topic: 'Physical Sciences (Newtonian)',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.2
    });
  }

  // TIER 1: Foundation - Life Sciences (Cellular)
  const bioFoundation = [
    {
      prompt: "What organelle is known as the 'powerhouse of the cell'?",
      options: { a: "Mitochondria", b: "Nucleus", c: "Ribosome", d: "Golgi apparatus" },
      correct: "Mitochondria"
    },
    {
      prompt: "What is the basic unit of life?",
      options: { a: "Cell", b: "Atom", c: "Molecule", d: "Organ" },
      correct: "Cell"
    },
    {
      prompt: "Plants convert sunlight into energy through:",
      options: { a: "Photosynthesis", b: "Respiration", c: "Fermentation", d: "Digestion" },
      correct: "Photosynthesis"
    },
    {
      prompt: "DNA is found primarily in which part of the cell?",
      options: { a: "Nucleus", b: "Cytoplasm", c: "Cell membrane", d: "Ribosome" },
      correct: "Nucleus"
    },
    {
      prompt: "What type of cell division results in two identical daughter cells?",
      options: { a: "Mitosis", b: "Meiosis", c: "Binary fission", d: "Budding" },
      correct: "Mitosis"
    },
  ];

  for (const q of bioFoundation) {
    items.push({
      id: `sci_found_bio_${uuidv4().slice(0, 8)}`,
      stat_name: 'science',
      topic: 'Life Sciences (Cellular)',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.2
    });
  }

  // TIER 2: Bridge - Organic Chemistry
  const orgChem = [
    {
      prompt: "What type of bond holds carbon atoms together in organic molecules?",
      options: { a: "Covalent bonds", b: "Ionic bonds", c: "Hydrogen bonds", d: "Van der Waals forces" },
      correct: "Covalent bonds"
    },
    {
      prompt: "What is the general formula for alkanes?",
      options: { a: "CₙH₂ₙ₊₂", b: "CₙH₂ₙ", c: "CₙHₙ", d: "CₙH₂ₙ₋₂" },
      correct: "CₙH₂ₙ₊₂"
    },
    {
      prompt: "Ethanol (C₂H₅OH) is classified as:",
      options: { a: "An alcohol", b: "An alkene", c: "A carboxylic acid", d: "An ether" },
      correct: "An alcohol"
    },
    {
      prompt: "What functional group defines a carboxylic acid?",
      options: { a: "-COOH", b: "-OH", c: "-CHO", d: "-NH₂" },
      correct: "-COOH"
    },
    {
      prompt: "Benzene (C₆H₆) is an example of:",
      options: { a: "An aromatic compound", b: "An alkane", c: "An alkyne", d: "An ester" },
      correct: "An aromatic compound"
    },
  ];

  for (const q of orgChem) {
    items.push({
      id: `sci_bridge_orgchem_${uuidv4().slice(0, 8)}`,
      stat_name: 'science',
      topic: 'Organic Chemistry',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.5
    });
  }

  // TIER 2: Bridge - Genetics
  const genetics = [
    {
      prompt: "If a trait is recessive, it will be expressed when:",
      options: {
        a: "Both alleles are recessive (homozygous recessive)",
        b: "One allele is dominant",
        c: "The organism is male",
        d: "The environment triggers it"
      },
      correct: "Both alleles are recessive (homozygous recessive)"
    },
    {
      prompt: "What does DNA stand for?",
      options: {
        a: "Deoxyribonucleic acid",
        b: "Dinitrogen acid",
        c: "Dual nucleotide acid",
        d: "Deoxy nucleotide arrangement"
      },
      correct: "Deoxyribonucleic acid"
    },
    {
      prompt: "In a Punnett square cross of Aa × Aa, what percentage of offspring will be homozygous dominant (AA)?",
      options: { a: "25%", b: "50%", c: "75%", d: "100%" },
      correct: "25%"
    },
    {
      prompt: "Which base pairs with Adenine (A) in DNA?",
      options: { a: "Thymine (T)", b: "Guanine (G)", c: "Cytosine (C)", d: "Uracil (U)" },
      correct: "Thymine (T)"
    },
  ];

  for (const q of genetics) {
    items.push({
      id: `sci_bridge_genetics_${uuidv4().slice(0, 8)}`,
      stat_name: 'science',
      topic: 'Genetics & Epigenetics',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.5
    });
  }

  // TIER 3: Power - Relativity
  const relativity = [
    {
      prompt: "According to special relativity, what is constant for all observers?",
      options: {
        a: "The speed of light in a vacuum",
        b: "Time",
        c: "Mass",
        d: "Length"
      },
      correct: "The speed of light in a vacuum"
    },
    {
      prompt: "Einstein's famous equation E=mc² shows that:",
      options: {
        a: "Mass and energy are equivalent",
        b: "Speed equals distance over time",
        c: "Force equals mass times acceleration",
        d: "Momentum is conserved"
      },
      correct: "Mass and energy are equivalent"
    },
    {
      prompt: "Time dilation means that time passes more slowly for:",
      options: {
        a: "Objects moving at high speeds relative to an observer",
        b: "Objects at rest",
        c: "Objects with less mass",
        d: "Objects in a vacuum"
      },
      correct: "Objects moving at high speeds relative to an observer"
    },
  ];

  for (const q of relativity) {
    items.push({
      id: `sci_power_rel_${uuidv4().slice(0, 8)}`,
      stat_name: 'science',
      topic: 'Relativity (Special & General)',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.7
    });
  }

  // TIER 4: Horizon - Quantum Mechanics
  const quantum = [
    {
      prompt: "The Heisenberg Uncertainty Principle states that you cannot simultaneously know:",
      options: {
        a: "Both the exact position and momentum of a particle",
        b: "The mass and charge of a particle",
        c: "The spin and color of a quark",
        d: "The energy and frequency of light"
      },
      correct: "Both the exact position and momentum of a particle"
    },
    {
      prompt: "What phenomenon describes a particle existing in multiple states until observed?",
      options: { a: "Superposition", b: "Entanglement", c: "Tunneling", d: "Decoherence" },
      correct: "Superposition"
    },
    {
      prompt: "Schrödinger's wave equation describes:",
      options: {
        a: "The probability amplitude of a quantum system",
        b: "The path of a classical particle",
        c: "The frequency of electromagnetic waves",
        d: "The energy levels of planets"
      },
      correct: "The probability amplitude of a quantum system"
    },
    {
      prompt: "Quantum entanglement allows particles to:",
      options: {
        a: "Instantaneously correlate their states regardless of distance",
        b: "Travel faster than light",
        c: "Gain infinite energy",
        d: "Exist without mass"
      },
      correct: "Instantaneously correlate their states regardless of distance"
    },
  ];

  for (const q of quantum) {
    items.push({
      id: `sci_horizon_qm_${uuidv4().slice(0, 8)}`,
      stat_name: 'science',
      topic: 'Quantum Mechanics',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.9
    });
  }

  return items;
}

// =============================================================================
// CRITICAL THINKING QUESTIONS
// =============================================================================

function generateCriticalThinkingQuestions(): QuestionItem[] {
  const items: QuestionItem[] = [];

  // TIER 1: Foundation - Logic & Reasoning
  const logic = [
    {
      prompt: "All dogs are mammals. Fido is a dog. Therefore:",
      options: {
        a: "Fido is a mammal",
        b: "Fido is not a mammal",
        c: "Some mammals are dogs",
        d: "All mammals are dogs"
      },
      correct: "Fido is a mammal"
    },
    {
      prompt: "If A → B, and B → C, then:",
      options: { a: "A → C", b: "C → A", c: "B → A", d: "A = C" },
      correct: "A → C"
    },
    {
      prompt: "Which of these is NOT a valid logical fallacy?",
      options: {
        a: "Valid modus ponens",
        b: "Ad hominem",
        c: "Straw man",
        d: "Appeal to authority"
      },
      correct: "Valid modus ponens"
    },
    {
      prompt: "The statement 'Either it will rain today, or it won't' is an example of:",
      options: { a: "A tautology", b: "A contradiction", c: "A contingency", d: "A fallacy" },
      correct: "A tautology"
    },
    {
      prompt: "'All swans are white' can be disproven by:",
      options: {
        a: "Finding one non-white swan",
        b: "Finding many white swans",
        c: "Proving swans exist",
        d: "Defining what 'white' means"
      },
      correct: "Finding one non-white swan"
    },
  ];

  for (const q of logic) {
    items.push({
      id: `ct_found_logic_${uuidv4().slice(0, 8)}`,
      stat_name: 'critical_thinking',
      topic: 'Logic & Reasoning (Formal)',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.3
    });
  }

  // TIER 2: Bridge - Cognitive Biases
  const biases = [
    {
      prompt: "Confirmation bias causes people to:",
      options: {
        a: "Seek information that supports their existing beliefs",
        b: "Always disagree with others",
        c: "Change their mind frequently",
        d: "Trust authority figures"
      },
      correct: "Seek information that supports their existing beliefs"
    },
    {
      prompt: "The availability heuristic leads people to:",
      options: {
        a: "Overestimate the likelihood of events they can easily recall",
        b: "Make optimal decisions",
        c: "Ignore recent events",
        d: "Always trust statistics"
      },
      correct: "Overestimate the likelihood of events they can easily recall"
    },
    {
      prompt: "Anchoring bias occurs when:",
      options: {
        a: "Initial information disproportionately influences later judgments",
        b: "People refuse to change their minds",
        c: "Decisions are made too quickly",
        d: "People follow the crowd"
      },
      correct: "Initial information disproportionately influences later judgments"
    },
    {
      prompt: "The Dunning-Kruger effect describes:",
      options: {
        a: "Less competent individuals overestimating their abilities",
        b: "Experts always being correct",
        c: "Intelligence decreasing with age",
        d: "Education reducing confidence"
      },
      correct: "Less competent individuals overestimating their abilities"
    },
  ];

  for (const q of biases) {
    items.push({
      id: `ct_bridge_bias_${uuidv4().slice(0, 8)}`,
      stat_name: 'critical_thinking',
      topic: 'Cognitive Bias Mitigation',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.5
    });
  }

  // TIER 3: Power - Systems Thinking
  const systems = [
    {
      prompt: "In systems thinking, a 'feedback loop' is:",
      options: {
        a: "A cycle where outputs influence future inputs",
        b: "A one-way flow of information",
        c: "A type of error correction",
        d: "A management technique"
      },
      correct: "A cycle where outputs influence future inputs"
    },
    {
      prompt: "Emergence in complex systems refers to:",
      options: {
        a: "Properties that arise from interactions but don't exist in components alone",
        b: "The creation of new systems",
        c: "Systems becoming simpler over time",
        d: "Predictable outcomes from known inputs"
      },
      correct: "Properties that arise from interactions but don't exist in components alone"
    },
    {
      prompt: "A 'wicked problem' in systems thinking is characterized by:",
      options: {
        a: "No clear solution and interdependent factors",
        b: "Easy to solve with enough data",
        c: "Always having one right answer",
        d: "Being purely mathematical"
      },
      correct: "No clear solution and interdependent factors"
    },
  ];

  for (const q of systems) {
    items.push({
      id: `ct_power_sys_${uuidv4().slice(0, 8)}`,
      stat_name: 'critical_thinking',
      topic: 'Systems Thinking',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.7
    });
  }

  // TIER 4: Horizon - Epistemology
  const epistemology = [
    {
      prompt: "The problem of induction, identified by Hume, questions:",
      options: {
        a: "Whether past patterns can justify future predictions",
        b: "How electricity works",
        c: "Why people lie",
        d: "Mathematical proofs"
      },
      correct: "Whether past patterns can justify future predictions"
    },
    {
      prompt: "Falsificationism (Popper) argues that scientific theories should be:",
      options: {
        a: "Capable of being proven wrong",
        b: "Absolutely certain",
        c: "Based only on observation",
        d: "Unchangeable once established"
      },
      correct: "Capable of being proven wrong"
    },
    {
      prompt: "The Gettier problem challenges the traditional definition of knowledge as:",
      options: {
        a: "Justified true belief",
        b: "Mere opinion",
        c: "Scientific fact",
        d: "Sensory experience"
      },
      correct: "Justified true belief"
    },
  ];

  for (const q of epistemology) {
    items.push({
      id: `ct_horizon_epis_${uuidv4().slice(0, 8)}`,
      stat_name: 'critical_thinking',
      topic: 'Epistemology & Truth',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.9
    });
  }

  return items;
}

// =============================================================================
// SOCIAL STUDIES QUESTIONS (Replacing garbage)
// =============================================================================

function generateSocialStudiesQuestions(): QuestionItem[] {
  const items: QuestionItem[] = [];

  // TIER 1: Foundation - History
  const history = [
    {
      prompt: "The American Declaration of Independence was signed in:",
      options: { a: "1776", b: "1789", c: "1812", d: "1620" },
      correct: "1776"
    },
    {
      prompt: "Which civilization built the Great Pyramid of Giza?",
      options: { a: "Ancient Egypt", b: "Ancient Greece", c: "Roman Empire", d: "Mesopotamia" },
      correct: "Ancient Egypt"
    },
    {
      prompt: "The Industrial Revolution began in which country?",
      options: { a: "Great Britain", b: "United States", c: "Germany", d: "France" },
      correct: "Great Britain"
    },
    {
      prompt: "Who was the first President of the United States?",
      options: { a: "George Washington", b: "Thomas Jefferson", c: "John Adams", d: "Benjamin Franklin" },
      correct: "George Washington"
    },
    {
      prompt: "World War I ended in:",
      options: { a: "1918", b: "1914", c: "1945", d: "1939" },
      correct: "1918"
    },
  ];

  for (const q of history) {
    items.push({
      id: `ss_found_hist_${uuidv4().slice(0, 8)}`,
      stat_name: 'social_studies',
      topic: 'History (World & US)',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.2
    });
  }

  // TIER 1: Foundation - Geography
  const geography = [
    {
      prompt: "What is the largest continent by area?",
      options: { a: "Asia", b: "Africa", c: "North America", d: "Europe" },
      correct: "Asia"
    },
    {
      prompt: "The Amazon River flows primarily through which country?",
      options: { a: "Brazil", b: "Peru", c: "Colombia", d: "Venezuela" },
      correct: "Brazil"
    },
    {
      prompt: "Which mountain range separates Europe from Asia?",
      options: { a: "Ural Mountains", b: "Alps", c: "Himalayas", d: "Rockies" },
      correct: "Ural Mountains"
    },
    {
      prompt: "What is the smallest country in the world by area?",
      options: { a: "Vatican City", b: "Monaco", c: "San Marino", d: "Liechtenstein" },
      correct: "Vatican City"
    },
  ];

  for (const q of geography) {
    items.push({
      id: `ss_found_geo_${uuidv4().slice(0, 8)}`,
      stat_name: 'social_studies',
      topic: 'Geography & Geopolitics',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.2
    });
  }

  // TIER 2: Bridge - Economics
  const economics = [
    {
      prompt: "Supply and demand interact to determine:",
      options: { a: "Market price", b: "Government policy", c: "Population growth", d: "Climate change" },
      correct: "Market price"
    },
    {
      prompt: "Inflation is defined as:",
      options: {
        a: "A general increase in prices over time",
        b: "A decrease in unemployment",
        c: "Economic growth",
        d: "Lower interest rates"
      },
      correct: "A general increase in prices over time"
    },
    {
      prompt: "GDP stands for:",
      options: {
        a: "Gross Domestic Product",
        b: "General Distribution Policy",
        c: "Government Debt Percentage",
        d: "Global Development Plan"
      },
      correct: "Gross Domestic Product"
    },
    {
      prompt: "A recession is typically defined as:",
      options: {
        a: "Two consecutive quarters of declining GDP",
        b: "Any year of slow growth",
        c: "Rising unemployment above 10%",
        d: "Stock market crash"
      },
      correct: "Two consecutive quarters of declining GDP"
    },
  ];

  for (const q of economics) {
    items.push({
      id: `ss_bridge_econ_${uuidv4().slice(0, 8)}`,
      stat_name: 'social_studies',
      topic: 'Economics (Macro/Micro)',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.5
    });
  }

  // TIER 3: Power - Sociology
  const sociology = [
    {
      prompt: "Social stratification refers to:",
      options: {
        a: "The hierarchical arrangement of groups in society",
        b: "Individual personality types",
        c: "Geographic boundaries",
        d: "Language differences"
      },
      correct: "The hierarchical arrangement of groups in society"
    },
    {
      prompt: "Cultural relativism is the view that:",
      options: {
        a: "Cultures should be understood on their own terms",
        b: "All cultures are the same",
        c: "Western culture is superior",
        d: "Culture doesn't affect behavior"
      },
      correct: "Cultures should be understood on their own terms"
    },
    {
      prompt: "Max Weber's concept of 'bureaucracy' emphasized:",
      options: {
        a: "Rationalization and hierarchical organization",
        b: "Emotional decision-making",
        c: "Worker ownership of means of production",
        d: "Charismatic leadership"
      },
      correct: "Rationalization and hierarchical organization"
    },
  ];

  for (const q of sociology) {
    items.push({
      id: `ss_power_soc_${uuidv4().slice(0, 8)}`,
      stat_name: 'social_studies',
      topic: 'Sociology & Anthropology',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.7
    });
  }

  // TIER 4: Horizon - Philosophy & Ethics
  const philosophy = [
    {
      prompt: "Utilitarianism judges actions based on:",
      options: {
        a: "The greatest good for the greatest number",
        b: "Divine command",
        c: "Natural rights",
        d: "Virtue development"
      },
      correct: "The greatest good for the greatest number"
    },
    {
      prompt: "Kant's categorical imperative states that you should:",
      options: {
        a: "Act only according to rules you could will to be universal laws",
        b: "Maximize your own happiness",
        c: "Follow your emotions",
        d: "Obey authority without question"
      },
      correct: "Act only according to rules you could will to be universal laws"
    },
    {
      prompt: "The trolley problem is used to illustrate tensions between:",
      options: {
        a: "Deontological and consequentialist ethics",
        b: "Science and religion",
        c: "Individual and society",
        d: "Past and future"
      },
      correct: "Deontological and consequentialist ethics"
    },
    {
      prompt: "Rawls' 'veil of ignorance' thought experiment asks us to design society as if we:",
      options: {
        a: "Didn't know what position we'd hold in it",
        b: "Were immortal",
        c: "Had perfect knowledge",
        d: "Were all identical"
      },
      correct: "Didn't know what position we'd hold in it"
    },
  ];

  for (const q of philosophy) {
    items.push({
      id: `ss_horizon_phil_${uuidv4().slice(0, 8)}`,
      stat_name: 'social_studies',
      topic: 'Philosophy & Ethics',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.9
    });
  }

  return items;
}

// =============================================================================
// READING QUESTIONS (Additional high-quality)
// =============================================================================

function generateReadingQuestions(): QuestionItem[] {
  const items: QuestionItem[] = [];

  // TIER 1: Foundation - Key Ideas
  const keyIdeas = [
    {
      prompt: "The main idea of a passage is:",
      options: {
        a: "The central point the author wants to communicate",
        b: "The first sentence",
        c: "A minor detail",
        d: "The title only"
      },
      correct: "The central point the author wants to communicate"
    },
    {
      prompt: "Making an inference means:",
      options: {
        a: "Drawing conclusions from evidence in the text",
        b: "Copying the text exactly",
        c: "Guessing randomly",
        d: "Only reading the first paragraph"
      },
      correct: "Drawing conclusions from evidence in the text"
    },
    {
      prompt: "Context clues help readers:",
      options: {
        a: "Determine the meaning of unfamiliar words",
        b: "Skip difficult passages",
        c: "Read faster",
        d: "Memorize facts"
      },
      correct: "Determine the meaning of unfamiliar words"
    },
  ];

  for (const q of keyIdeas) {
    items.push({
      id: `read_found_key_${uuidv4().slice(0, 8)}`,
      stat_name: 'reading',
      topic: 'Key Ideas & Details',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.2
    });
  }

  // TIER 2: Bridge - Literary Analysis
  const literary = [
    {
      prompt: "An unreliable narrator is a storytelling technique where:",
      options: {
        a: "The narrator's credibility is compromised",
        b: "The narrator is always honest",
        c: "The story is told in third person",
        d: "The narrator is the author"
      },
      correct: "The narrator's credibility is compromised"
    },
    {
      prompt: "Symbolism in literature refers to:",
      options: {
        a: "Using objects or actions to represent abstract ideas",
        b: "Writing in code",
        c: "Using only literal language",
        d: "Avoiding metaphors"
      },
      correct: "Using objects or actions to represent abstract ideas"
    },
    {
      prompt: "The term 'protagonist' refers to:",
      options: {
        a: "The main character of a story",
        b: "The villain",
        c: "The narrator",
        d: "The author"
      },
      correct: "The main character of a story"
    },
    {
      prompt: "Irony occurs when:",
      options: {
        a: "There's a contrast between expectation and reality",
        b: "A character speaks directly to the audience",
        c: "The setting is described in detail",
        d: "Dialogue is used extensively"
      },
      correct: "There's a contrast between expectation and reality"
    },
  ];

  for (const q of literary) {
    items.push({
      id: `read_bridge_lit_${uuidv4().slice(0, 8)}`,
      stat_name: 'reading',
      topic: 'Literary Theory & Criticism',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.5
    });
  }

  // TIER 3: Power - Comparative Literature
  const comparative = [
    {
      prompt: "Intertextuality refers to:",
      options: {
        a: "The relationship between texts that reference or influence each other",
        b: "Reading multiple books simultaneously",
        c: "International literature",
        d: "Translating between languages"
      },
      correct: "The relationship between texts that reference or influence each other"
    },
    {
      prompt: "The hero's journey archetype, identified by Joseph Campbell, includes:",
      options: {
        a: "A call to adventure, trials, and transformation",
        b: "Only victory and triumph",
        c: "Staying home and avoiding risk",
        d: "Multiple unrelated protagonists"
      },
      correct: "A call to adventure, trials, and transformation"
    },
  ];

  for (const q of comparative) {
    items.push({
      id: `read_power_comp_${uuidv4().slice(0, 8)}`,
      stat_name: 'reading',
      topic: 'Comparative Literature',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.7
    });
  }

  // TIER 4: Horizon - Semiotics
  const semiotics = [
    {
      prompt: "In semiotics, a 'sign' consists of:",
      options: {
        a: "A signifier and a signified",
        b: "Only written words",
        c: "Visual images only",
        d: "Spoken language only"
      },
      correct: "A signifier and a signified"
    },
    {
      prompt: "Derrida's concept of 'différance' suggests that meaning is:",
      options: {
        a: "Always deferred and differs from itself",
        b: "Fixed and stable",
        c: "Determined by the author alone",
        d: "Universal across all cultures"
      },
      correct: "Always deferred and differs from itself"
    },
    {
      prompt: "Roland Barthes declared the 'death of the author' to emphasize:",
      options: {
        a: "The reader's role in creating meaning",
        b: "The end of literature",
        c: "The importance of biography",
        d: "Authorial intent as supreme"
      },
      correct: "The reader's role in creating meaning"
    },
  ];

  for (const q of semiotics) {
    items.push({
      id: `read_horizon_sem_${uuidv4().slice(0, 8)}`,
      stat_name: 'reading',
      topic: 'Semiotics & Symbology',
      prompt: q.prompt,
      options: JSON.stringify(q.options),
      correct: q.correct,
      difficulty: 0.9
    });
  }

  return items;
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

const allItems: QuestionItem[] = [
  ...generateScienceQuestions(),
  ...generateCriticalThinkingQuestions(),
  ...generateSocialStudiesQuestions(),
  ...generateReadingQuestions(),
];

console.log(`Generated ${allItems.length} real assessment items.`);
console.log(`  - Science: ${allItems.filter(i => i.stat_name === 'science').length}`);
console.log(`  - Critical Thinking: ${allItems.filter(i => i.stat_name === 'critical_thinking').length}`);
console.log(`  - Social Studies: ${allItems.filter(i => i.stat_name === 'social_studies').length}`);
console.log(`  - Reading: ${allItems.filter(i => i.stat_name === 'reading').length}`);

// Delete existing garbage social studies (the 151 that may be bad)
db.prepare(`DELETE FROM hyro_diagnostic_questions WHERE stat_name = 'social_studies'`).run();
console.log('Purged existing social studies questions.');

// Insert all items
const stmt = db.prepare(`
  INSERT OR IGNORE INTO hyro_diagnostic_questions
  (id, stat_name, topic, question_text, options, correct_answer, difficulty_level, question_type, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'multiple_choice', 1)
`);

db.transaction(() => {
  for (const item of allItems) {
    stmt.run(
      item.id,
      item.stat_name,
      item.topic,
      item.prompt,
      item.options,
      item.correct,
      item.difficulty
    );
  }
})();

console.log('Inserted all items into database.');

// Verify counts
const counts = db.prepare(`
  SELECT stat_name, COUNT(*) as count
  FROM hyro_diagnostic_questions
  GROUP BY stat_name
`).all();

console.log('\nFinal question counts:');
for (const row of counts as any[]) {
  console.log(`  ${row.stat_name}: ${row.count}`);
}
