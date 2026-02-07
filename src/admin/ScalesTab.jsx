return (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-[#4B3425]">量表数据</h2>
      <p className="text-sm text-[#8B7A6A]">{scales.length} 条记录</p>
    </div>
    
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left py-3 px-4 text-[#8B7A6A] font-normal">学生</th>
            <th className="text-left py-3 px-4 text-[#8B7A6A] font-normal">量表名称</th>
            <th className="text-left py-3 px-4 text-[#8B7A6A] font-normal">总分</th>
            <th className="text-left py-3 px-4 text-[#8B7A6A] font-normal">风险等级</th>
            <th className="text-left py-3 px-4 text-[#8B7A6A] font-normal">提交时间</th>
          </tr>
        </thead>
        <tbody>
          {scales.length > 0 ? scales.map((scale, index) => (
            <tr key={scale._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}>
              <td className="py-3 px-4 text-[#4B3425]">{scale.username}</td>
              <td className="py-3 px-4 text-[#4B3425]">{scale.scaleName}</td>
              <td className="py-3 px-4 text-[#4B3425]">{scale.totalScore || '-'}</td>
              <td className="py-3 px-4">
                <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                  scale.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                  scale.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {scale.riskLevel === 'high' ? '高风险' : 
                   scale.riskLevel === 'medium' ? '中风险' : '低风险'}
                </span>
              </td>
              <td className="py-3 px-4 text-[#8B7A6A] text-sm">
                {new Date(scale.submittedAt).toLocaleString()}
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="5" className="py-10 text-center text-[#8B7A6A]">暂无量表数据</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);