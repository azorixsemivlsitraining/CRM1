export interface AccountingSubcategory {
  code: string;
  name: string;
}

export interface AccountingCategory {
  code: string;
  name: string;
  description: string;
  subcategories: (AccountingSubcategory | AccountingCategoryGroup)[];
}

export interface AccountingCategoryGroup extends AccountingSubcategory {
  sub: AccountingSubcategory[];
}

const isCategoryGroup = (item: AccountingSubcategory | AccountingCategoryGroup): item is AccountingCategoryGroup => {
  return 'sub' in item;
};

export const ACCOUNTING_CATEGORIES: AccountingCategory[] = [
  {
    code: '5000',
    name: 'Cost of Goods Sold (COGS)',
    description: 'Costs directly tied to delivering products/services to customers',
    subcategories: [
      { code: '5100', name: 'Direct Materials/Purchases' },
      { code: '5200', name: 'Direct Labor' },
      { code: '5300', name: 'Subcontractors / Freelancers' },
      { code: '5400', name: 'Direct Software & Subscriptions' },
      { code: '5500', name: 'Transaction Fees' },
    ],
  },
  {
    code: '6000',
    name: 'Operating Expenses (OPEX)',
    description: 'Costs to keep the business running, regardless of sales',
    subcategories: [
      {
        code: '6100',
        name: 'General & Administrative (G&A)',
        sub: [
          { code: '6110', name: 'Rent & Lease' },
          { code: '6120', name: 'Utilities (Internet, Phone, Electricity)' },
          { code: '6130', name: 'Office Supplies' },
          { code: '6140', name: 'Business Insurance' },
          { code: '6150', name: 'Bank Fees & Charges' },
        ],
      },
      {
        code: '6200',
        name: 'Sales & Marketing (S&M)',
        sub: [
          { code: '6210', name: 'Advertising' },
          { code: '6220', name: 'Marketing & Promotion' },
          { code: '6230', name: 'Sales Commissions' },
          { code: '6240', name: 'CRM Software' },
          { code: '6250', name: 'Website & Domain Expenses' },
        ],
      },
      {
        code: '6300',
        name: 'Personnel / Payroll',
        sub: [
          { code: '6310', name: 'Salaries & Wages' },
          { code: '6320', name: 'Employer Payroll Taxes' },
          { code: '6330', name: 'Employee Benefits' },
          { code: '6340', name: 'Workers\' Compensation' },
        ],
      },
      {
        code: '6400',
        name: 'Travel & Entertainment (T&E)',
        sub: [
          { code: '6410', name: 'Flights & Airfare' },
          { code: '6420', name: 'Hotels & Lodging' },
          { code: '6430', name: 'Ground Transport' },
          { code: '6440', name: 'Meals' },
        ],
      },
      {
        code: '6500',
        name: 'Professional Fees',
        sub: [
          { code: '6510', name: 'Accounting & Bookkeeping' },
          { code: '6520', name: 'Legal Fees' },
          { code: '6530', name: 'Business Consulting' },
        ],
      },
      {
        code: '6600',
        name: 'Technology & IT',
        sub: [
          { code: '6610', name: 'General Software' },
          { code: '6620', name: 'IT Support & Services' },
          { code: '6630', name: 'Computer Hardware' },
        ],
      },
    ],
  },
  {
    code: '7000',
    name: 'Other Income & Expense',
    description: 'Outside normal operations',
    subcategories: [
      { code: '7100', name: 'Interest Expense' },
      { code: '7200', name: 'Charitable Contributions' },
      { code: '7300', name: 'Taxes' },
    ],
  },
  {
    code: '8000',
    name: 'Non-Cash Expenses',
    description: 'Non-cash items for accounting purposes',
    subcategories: [
      { code: '8100', name: 'Depreciation' },
      { code: '8200', name: 'Amortization' },
    ],
  },
];

export const getMainCategories = () => ACCOUNTING_CATEGORIES;

export const getSubcategoriesByMainCode = (mainCode: string): (AccountingSubcategory | AccountingCategoryGroup)[] => {
  const main = ACCOUNTING_CATEGORIES.find((c) => c.code === mainCode);
  return main ? main.subcategories : [];
};

export const getAllLeafCategories = (): AccountingSubcategory[] => {
  const leaves: AccountingSubcategory[] = [];

  for (const main of ACCOUNTING_CATEGORIES) {
    for (const sub of main.subcategories) {
      if (isCategoryGroup(sub)) {
        leaves.push(...sub.sub);
      } else {
        leaves.push(sub);
      }
    }
  }

  return leaves;
};

export const getCategoryNameByCode = (code: string): string => {
  for (const main of ACCOUNTING_CATEGORIES) {
    if (main.code === code) return main.name;
    for (const sub of main.subcategories) {
      if (sub.code === code) return sub.name;
      if (isCategoryGroup(sub)) {
        for (const leaf of sub.sub) {
          if (leaf.code === code) return leaf.name;
        }
      }
    }
  }
  return 'Unknown';
};

export const getMainCategoryByLeafCode = (code: string): string | null => {
  for (const main of ACCOUNTING_CATEGORIES) {
    for (const sub of main.subcategories) {
      if (sub.code === code) return main.code;
      if (isCategoryGroup(sub)) {
        for (const leaf of sub.sub) {
          if (leaf.code === code) return main.code;
        }
      }
    }
  }
  return null;
};
