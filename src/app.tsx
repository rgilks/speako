import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { SessionManager } from './components/SessionManager';
import { ValidatePage } from './components/ValidatePage';

export function App() {
  const route = useSignal(window.location.hash);

  useEffect(() => {
    const onHashChange = () => {
      route.value = window.location.hash;
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Show validation page for #validate
  if (route.value === '#validate') {
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
// test
