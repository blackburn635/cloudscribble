import { ButtonLink, Section, usePageTitle } from '../components/ui';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <Section className="text-center">
      <h1 className="text-5xl font-semibold">Page not found</h1>
      <p className="mt-4">That page doesn’t exist — it may have moved.</p>
      <div className="mt-8">
        <ButtonLink to="/">Back to home</ButtonLink>
      </div>
    </Section>
  );
}
