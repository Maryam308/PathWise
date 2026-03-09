const NETWORK_ERRORS = ["Failed to fetch", "NetworkError", "Load failed"];

const isBackendDown = (err) =>
  err instanceof TypeError &&
  NETWORK_ERRORS.some((msg) => err.message?.includes(msg));

export const apiFetch = async (url, options = {}) => {
  try {
    const res = await fetch(url, options);

    if (res.status === 401) {
      localStorage.removeItem("pathwise_token");
      localStorage.removeItem("pathwise_user");
      window.dispatchEvent(new Event("auth:logout"));
      return;
    }

    return res;
  } catch (err) {
    if (isBackendDown(err)) {
      window.dispatchEvent(new Event("auth:logout"));
      return;
    }
    throw err;
  }
};