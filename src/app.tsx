import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { SessionManager } from './components/SessionManager';
import { ValidatePage } from './components/ValidatePage';

const VALIDATE_ROUTE = '#validate';

export function App() {
  const route = useSignal(window.location.hash);

  useEffect(() => {
    const onHashChange = () => {
      route.value = window.location.hash;
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (route.value === VALIDATE_ROUTE) {
    return (
      <div className="container">
        <ValidatePage />
      </div>
    );
  }

  return (
    <div className="container">
      <SessionManager />
    </div>
  );
}
