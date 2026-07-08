import * as ProfileRepo from '../db/profiles.js';
import * as DocumentRepo from '../db/documents.js';

export const globalSearch = async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.json({ success: true, data: { customers: [], documents: [] } });
  }

  let customers = [];
  let documents = [];

  if (req.user.role === 'super_admin') {
    const { data: custData } = await ProfileRepo.find(
      { role: 'customer' },
      { search: { fields: ['name', 'email'], term: q }, limit: 10 }
    );
    customers = custData.map(c => ({
      _id: c.id,
      name: c.name,
      email: c.email,
    }));

    const { data: docData } = await DocumentRepo.find(
      { is_deleted: false },
      {
        search: { fields: ['title', 'original_name', 'custom_group_name', 'notes'], term: q },
        limit: 20,
      }
    );
    documents = docData.map(d => ({
      _id: d.id,
      customerId: d.customer ? { _id: d.customer_id, name: d.customer.name, email: d.customer.email } : d.customer_id,
      departmentId: d.department ? { _id: d.department_id, name: d.department.name } : d.department_id,
      title: d.title,
      originalName: d.original_name,
      customGroupName: d.custom_group_name,
      createdAt: d.created_at,
    }));
  } else if (req.user.role === 'department') {
    const deptId = req.user.departmentId;
    const { data: deptDocs } = await DocumentRepo.find(
      { department_id: deptId, is_deleted: false },
      { limit: 10000 }
    );
    const customerIdsSet = new Set(deptDocs.map(d => d.customer_id));
    const customerIds = [...customerIdsSet];

    // Fetch customers matching search
    const allCustomers = [];
    for (const cId of customerIds) {
      const profile = await ProfileRepo.findByIdLean(cId);
      if (profile) allCustomers.push(profile);
    }
    const term = q.toLowerCase();
    customers = allCustomers.filter(c =>
      c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
    ).slice(0, 10).map(c => ({ _id: c.id, name: c.name, email: c.email }));

    const { data: docData } = await DocumentRepo.find(
      { department_id: deptId, is_deleted: false },
      {
        search: { fields: ['title', 'original_name', 'custom_group_name', 'notes'], term: q },
        limit: 20,
      }
    );
    documents = docData.map(d => ({
      _id: d.id,
      customerId: d.customer ? { _id: d.customer_id, name: d.customer.name, email: d.customer.email } : d.customer_id,
      departmentId: d.department ? { _id: d.department_id, name: d.department.name } : d.department_id,
      title: d.title,
      originalName: d.original_name,
      customGroupName: d.custom_group_name,
      createdAt: d.created_at,
    }));
  } else if (req.user.role === 'customer') {
    const { data: docData } = await DocumentRepo.find(
      { customer_id: req.user._id, is_deleted: false },
      {
        search: { fields: ['title', 'original_name', 'custom_group_name'], term: q },
        limit: 20,
      }
    );
    documents = docData.map(d => ({
      _id: d.id,
      departmentId: d.department ? { _id: d.department_id, name: d.department.name } : d.department_id,
      title: d.title,
      originalName: d.original_name,
      customGroupName: d.custom_group_name,
      createdAt: d.created_at,
    }));
  }

  res.json({
    success: true,
    data: { customers, documents },
  });
};
