import type {
  ExternalAssignmentReportImport,
  GeneratedDocument,
} from "./api";
import {
  DocumentBuilder,
  type DocumentBuilderReviewer,
} from "./modules/document-builder";

type Props = {
  token: string;
  document: GeneratedDocument;
  assignmentTitle?: string;
  linkedTasks?: { id: string; title: string; status?: string }[];
  reviewers?: DocumentBuilderReviewer[];
  canEditAssignmentReport?: boolean;
  onClose: () => void;
  onSubmitForReview?: (
    documentId: string,
    reviewerId: string,
    comments: string,
  ) => Promise<void>;
  onExternalImported?: (
    documentId: string,
    imported: ExternalAssignmentReportImport,
  ) => Promise<void> | void;
};

export default function AssignmentReportSimpleEditor(props: Props) {
  return (
    <DocumentBuilder
      token={props.token}
      document={props.document}
      contextTitle={props.assignmentTitle}
      linkedSources={props.linkedTasks}
      reviewers={props.reviewers}
      canEdit={props.canEditAssignmentReport}
      onClose={props.onClose}
      onSubmitForReview={props.onSubmitForReview}
      onExternalImported={props.onExternalImported}
    />
  );
}
