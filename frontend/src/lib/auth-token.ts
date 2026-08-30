let memoryToken: string | null = null;
let activeCompanyId: string | null = null;

export const setAccessToken = (token: string | null) => {
  memoryToken = token;
};

export const getAccessToken = () => {
  return memoryToken;
};

export const setActiveCompanyId = (companyId: string | null) => {
  activeCompanyId = companyId;
  if (companyId) {
    localStorage.setItem('active_company_id', companyId);
  } else {
    localStorage.removeItem('active_company_id');
  }
};

export const getActiveCompanyId = () => {
  if (!activeCompanyId) {
    activeCompanyId = localStorage.getItem('active_company_id');
  }
  return activeCompanyId;
};
