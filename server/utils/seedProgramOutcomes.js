const mongoose = require('mongoose');
const ProgramOutcome = require('../models/ProgramOutcome');
require('dotenv').config();

const programOutcomes = [
  {
    po_code: 'PO_A',
    po_number: 1,
    title: 'Engineering Knowledge',
    description: 'Apply the knowledge of mathematics, science, engineering fundamentals, and an engineering specialization to the solution of complex engineering problems.'
  },
  {
    po_code: 'PO_B',
    po_number: 2,
    title: 'Problem Analysis',
    description: 'Identify, formulate, review research literature, and analyze complex engineering problems reaching substantiated conclusions using first principles of mathematics, natural sciences, and engineering sciences.'
  },
  {
    po_code: 'PO_C',
    po_number: 3,
    title: 'Design/Development of Solutions',
    description: 'Design solutions for complex engineering problems and design system components or processes that meet the specified needs with appropriate consideration for the public health and safety, and the cultural, societal, and environmental considerations.'
  },
  {
    po_code: 'PO_D',
    po_number: 4,
    title: 'Investigation',
    description: 'Use research-based knowledge and research methods including design of experiments, analysis and interpretation of data, and synthesis of the information to provide valid conclusions.'
  },
  {
    po_code: 'PO_E',
    po_number: 5,
    title: 'Modern Tool Usage',
    description: 'Create, select, and apply appropriate techniques, resources, and modern engineering and IT tools including prediction and modeling to complex engineering activities with an understanding of the limitations.'
  },
  {
    po_code: 'PO_F',
    po_number: 6,
    title: 'The Engineer and Society',
    description: 'Apply reasoning informed by the contextual knowledge to assess societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to the professional engineering practice.'
  },
  {
    po_code: 'PO_G',
    po_number: 7,
    title: 'Environment and Sustainability',
    description: 'Understand the impact of the professional engineering solutions in societal and environmental contexts, and demonstrate the knowledge of, and need for sustainable development.'
  },
  {
    po_code: 'PO_H',
    po_number: 8,
    title: 'Ethics',
    description: 'Apply ethical principles and commit to professional ethics and responsibilities and norms of the engineering practice.'
  },
  {
    po_code: 'PO_I',
    po_number: 9,
    title: 'Individual and Team Work',
    description: 'Function effectively as an individual, and as a member or leader in diverse teams, and in multidisciplinary settings.'
  },
  {
    po_code: 'PO_J',
    po_number: 10,
    title: 'Communication',
    description: 'Communicate effectively on complex engineering activities with the engineering community and with society at large, such as, being able to comprehend and write effective reports and design documentation, make effective presentations, and give and receive clear instructions.'
  },
  {
    po_code: 'PO_K',
    po_number: 11,
    title: 'Project Management and Finance',
    description: 'Demonstrate knowledge and understanding of the engineering and management principles and apply these to one\'s own work, as a member and leader in a team, to manage projects and in multidisciplinary environments.'
  },
  {
    po_code: 'PO_L',
    po_number: 12,
    title: 'Life-long Learning',
    description: 'Recognize the need for, and have the preparation and ability to engage in independent and life-long learning in the broadest context of technological change.'
  }
];

const seedProgramOutcomes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');

    const existingCount = await ProgramOutcome.countDocuments();
    
    if (existingCount > 0) {
      console.log(`Program Outcomes already seeded (${existingCount} records found)`);
      console.log('Skipping seed operation to prevent duplicates');
      process.exit(0);
    }

    const result = await ProgramOutcome.insertMany(programOutcomes);
    
    console.log('✓ Program Outcomes seeded successfully!');
    console.log(`✓ Inserted ${result.length} Program Outcomes (PO_A to PO_L)`);
    
    result.forEach(po => {
      console.log(`  - ${po.po_code} (PO${po.po_number}): ${po.title}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding Program Outcomes:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedProgramOutcomes();
}

module.exports = seedProgramOutcomes;
