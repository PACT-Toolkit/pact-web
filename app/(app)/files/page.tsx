import { FilesWorkbench } from '@/src/app/files';
import { PageContainer } from '@/src/components/page-container';

const FilesPage = () => {
  return (
    <PageContainer>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Files</h1>
        <p className="text-sm text-muted-foreground">
          Upload, monitor, and delete files. Bytes go directly from your browser
          to object storage using short-lived presigned URLs - they never pass
          through pact-gateway.
        </p>
      </header>
      <FilesWorkbench />
    </PageContainer>
  );
};

export default FilesPage;
