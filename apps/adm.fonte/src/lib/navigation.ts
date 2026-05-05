import { useNavigate } from "react-router-dom";

export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };
}
