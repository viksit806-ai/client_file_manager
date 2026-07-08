import auth from '../middleware/auth.js';
import requireRole from '../middleware/role.js';
import * as AuthController from '../controllers/auth.controller.js';
import * as AdminController from '../controllers/admin.controller.js';
import * as CustomerController from '../controllers/customer.controller.js';
import * as DepartmentController from '../controllers/department.controller.js';
import * as DocumentOpsController from '../controllers/documentOps.controller.js';
import * as NotificationController from '../controllers/notification.controller.js';
import * as SearchController from '../controllers/search.controller.js';
import { ApiResponse, errorToResponse, runHandler, runMiddleware } from './adapter.js';
import { parseMultipartBody } from './uploads.js';

const method = (verb, path, handler, options = {}) => ({ verb, path, handler, ...options });

const admin = [auth, requireRole('super_admin')];
const department = [auth, requireRole('department')];
const customer = [auth, requireRole('customer')];

const routes = [
  method('GET', '/health', (_, res) => res.json({ success: true, message: 'CA Portal API running' })),

  method('POST', '/auth/login', AuthController.login),
  method('PUT', '/auth/change-password', AuthController.changePassword, { middleware: [auth] }),
  method('GET', '/auth/me', AuthController.getMe, { middleware: [auth] }),

  method('GET', '/admin/dashboard', AdminController.getDashboard, { middleware: admin }),
  method('GET', '/admin/customers', AdminController.getCustomers, { middleware: admin }),
  method('POST', '/admin/customers', AdminController.createCustomer, { middleware: admin }),
  method('PUT', '/admin/customers/:id', AdminController.updateCustomer, { middleware: admin }),
  method('DELETE', '/admin/customers/:id', AdminController.deleteCustomer, { middleware: admin }),
  method('PUT', '/admin/customers/:id/reset-password', AdminController.resetCustomerPassword, { middleware: admin }),
  method('PUT', '/admin/customers/:id/set-password', AdminController.setCustomerPassword, { middleware: admin }),
  method('GET', '/admin/customers/:id/documents', AdminController.getCustomerDocuments, { middleware: admin }),
  method('GET', '/admin/departments', AdminController.getDepartments, { middleware: admin }),
  method('POST', '/admin/departments', AdminController.createDepartment, { middleware: admin }),
  method('PUT', '/admin/departments/:id', AdminController.updateDepartment, { middleware: admin }),
  method('DELETE', '/admin/departments/:id', AdminController.deleteDepartment, { middleware: admin }),
  method('PUT', '/admin/departments/:id/permissions', AdminController.updateDepartmentPermissions, { middleware: admin }),
  method('GET', '/admin/department-users', AdminController.getDepartmentUsers, { middleware: admin }),
  method('GET', '/admin/department-users/department/:deptId', AdminController.getDepartmentUsersByDept, { middleware: admin }),
  method('POST', '/admin/department-users', AdminController.createDepartmentUser, { middleware: admin }),
  method('PUT', '/admin/department-users/:id', AdminController.updateDepartmentUser, { middleware: admin }),
  method('DELETE', '/admin/department-users/:id', AdminController.deleteDepartmentUser, { middleware: admin }),
  method('PUT', '/admin/department-users/:id/reset-password', AdminController.resetDeptUserPassword, { middleware: admin }),
  method('PUT', '/admin/department-users/:id/set-password', AdminController.setDeptUserPassword, { middleware: admin }),
  method('GET', '/admin/file-categories', AdminController.getFileCategories, { middleware: admin }),
  method('POST', '/admin/file-categories', AdminController.createFileCategory, { middleware: admin }),
  method('PUT', '/admin/file-categories/:id', AdminController.updateFileCategory, { middleware: admin }),
  method('DELETE', '/admin/file-categories/:id', AdminController.deleteFileCategory, { middleware: admin }),
  method('GET', '/admin/documents', AdminController.getAllDocuments, { middleware: admin }),
  method('POST', '/admin/documents/batch', AdminController.adminBatchDocuments, { middleware: admin }),
  method('PATCH', '/admin/documents/:id/block', AdminController.adminBlockDocument, { middleware: admin }),
  method('PATCH', '/admin/documents/:id/unblock', AdminController.adminUnblockDocument, { middleware: admin }),
  method('PUT', '/admin/documents/:id', AdminController.adminUpdateDocument, { middleware: admin }),
  method('DELETE', '/admin/documents/:id', AdminController.adminDeleteDocument, { middleware: admin }),
  method('POST', '/admin/documents/:id/purge', AdminController.adminPurgeDocumentFiles, { middleware: admin }),
  method('PATCH', '/admin/documents/:id/rename', DocumentOpsController.renameDocument, { middleware: admin }),
  method('PATCH', '/admin/documents/group/:groupId/rename', DocumentOpsController.renameGroup, { middleware: admin }),
  method('DELETE', '/admin/documents/:id/soft', DocumentOpsController.deleteDocument, { middleware: admin }),
  method('DELETE', '/admin/documents/group/:groupId/soft', DocumentOpsController.deleteGroup, { middleware: admin }),
  method('POST', '/admin/documents/folder', DocumentOpsController.createEmptyFolder, { middleware: admin }),
  method('POST', '/admin/documents/group/:groupId/upload', DocumentOpsController.uploadFilesToFolder, { middleware: admin, upload: 'array' }),

  method('GET', '/department/dashboard', DepartmentController.getDashboard, { middleware: department }),
  method('GET', '/department/customers', DepartmentController.getCustomers, { middleware: department }),
  method('GET', '/department/customers/:customerId/documents', DepartmentController.getCustomerDocuments, { middleware: department }),
  method('PATCH', '/department/customers/:customerId/rename', DepartmentController.renameCustomer, { middleware: department }),
  method('GET', '/department/documents', DepartmentController.getDocuments, { middleware: department }),
  method('GET', '/department/documents/:id', DepartmentController.getDocumentDetail, { middleware: department }),
  method('PATCH', '/department/documents/:id/status', DepartmentController.updateDocumentStatus, { middleware: department }),
  method('GET', '/department/file-categories', DepartmentController.getDepartmentFileCategories, { middleware: department }),
  method('POST', '/department/responses', DepartmentController.createResponse, { middleware: department, upload: 'single' }),
  method('GET', '/department/responses', DepartmentController.getResponses, { middleware: department }),
  method('PATCH', '/department/documents/:id/block', DepartmentController.blockDocument, { middleware: department }),
  method('PATCH', '/department/documents/:id/unblock', DepartmentController.unblockDocument, { middleware: department }),
  method('PUT', '/department/documents/:id/notes', DepartmentController.updateNotes, { middleware: department }),
  method('GET', '/department/documents/:id/download', DepartmentController.downloadFile, { middleware: department }),
  method('POST', '/department/documents/:id/purge', DepartmentController.departmentPurgeDocumentFiles, { middleware: department }),
  method('PATCH', '/department/documents/:id/rename', DocumentOpsController.renameDocument, { middleware: department }),
  method('PATCH', '/department/documents/group/:groupId/rename', DocumentOpsController.renameGroup, { middleware: department }),
  method('POST', '/department/documents/batch', DepartmentController.departmentBatchDocuments, { middleware: department }),
  method('DELETE', '/department/documents/:id', DocumentOpsController.deleteDocument, { middleware: department }),
  method('DELETE', '/department/documents/group/:groupId', DocumentOpsController.deleteGroup, { middleware: department }),
  method('POST', '/department/documents/folder', DocumentOpsController.createEmptyFolder, { middleware: department }),
  method('POST', '/department/documents/group/:groupId/upload', DocumentOpsController.uploadFilesToFolder, { middleware: department, upload: 'array' }),

  method('GET', '/customer/departments', CustomerController.getDepartments, { middleware: customer }),
  method('POST', '/customer/upload', CustomerController.uploadDocument, { middleware: customer, upload: 'array' }),
  method('GET', '/customer/documents', CustomerController.getDocuments, { middleware: customer }),
  method('GET', '/customer/documents/:id/download', CustomerController.downloadDocument, { middleware: customer }),
  method('GET', '/customer/responses', CustomerController.getResponses, { middleware: customer }),
  method('GET', '/customer/response-categories', CustomerController.getResponseCategories, { middleware: customer }),
  method('GET', '/customer/categories', CustomerController.getResponseCategories, { middleware: customer }),

  method('GET', '/notifications', NotificationController.getNotifications, { middleware: [auth] }),
  method('GET', '/notifications/count', NotificationController.getNotificationCount, { middleware: [auth] }),
  method('DELETE', '/notifications/:id', NotificationController.deleteNotification, { middleware: [auth] }),
  method('GET', '/search', SearchController.globalSearch, { middleware: [auth] }),
];

const compile = (route) => {
  const keys = [];
  const pattern = route.path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      if (!part.startsWith(':')) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      keys.push(part.slice(1));
      return '([^/]+)';
    })
    .join('/');

  return {
    ...route,
    regex: new RegExp(`^/${pattern}$`),
    keys,
  };
};

const compiledRoutes = routes.map(compile);

const getBody = async (request) => {
  const contentType = request.headers.get('content-type') || '';
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return {};
  if (!contentType.includes('application/json')) return {};

  const text = await request.text();
  return text ? JSON.parse(text) : {};
};

const createRequest = async (request, context, route) => {
  const url = new URL(request.url);
  const match = route.regex.exec(url.pathname.replace(/^\/api/, '') || '/');
  const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));

  let body = await getBody(request);
  let files;
  let file;
  if (route.upload) {
    const parsed = await parseMultipartBody(request, route.upload);
    body = parsed.body;
    files = parsed.files;
    file = parsed.file;
  }

  return {
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    query: Object.fromEntries(url.searchParams.entries()),
    params,
    body,
    files,
    file,
    user: undefined,
    nextRequest: request,
    nextContext: context,
  };
};

const findRoute = (request) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  return compiledRoutes.find((route) => route.verb === request.method && route.regex.test(path));
};

export const handleApiRequest = async (request, context = {}) => {
  try {
    const route = findRoute(request);
    if (!route) {
      return Response.json({ success: false, message: 'Route not found' }, { status: 404 });
    }

    const req = await createRequest(request, context, route);
    const res = new ApiResponse();
    for (const middleware of route.middleware || []) {
      await runMiddleware(middleware, req, res);
    }

    return await runHandler(route.handler, req);
  } catch (error) {
    return errorToResponse(error);
  }
};
